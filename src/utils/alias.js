/**
 * エイリアス処理ユーティリティ
 * アカウントIDの検出、エイリアスの適用、DOM要素の更新を管理
 */

class AliasManager {
  // AWSアカウントIDの正規表現パターン
  // 12桁の数字（連続）または ハイフン区切り形式（1234-5678-9012）
  // より柔軟なマッチングのため、前後の文字制限を緩和
  static ACCOUNT_ID_PATTERN = /(\d{4}-\d{4}-\d{4}|\d{12})/g;

  // ハイフン区切りアカウントIDパターン（表示形式）
  static FORMATTED_ACCOUNT_ID_PATTERN = /\b(\d{4}-\d{4}-\d{4})\b/g;

  /**
   * ハイフン区切りのアカウントIDを12桁の形式に正規化
   * @param {string} accountId - アカウントID（ハイフン区切りまたは12桁）
   * @returns {string} 12桁のアカウントID
   */
  static normalizeAccountId(accountId) {
    return accountId.replace(/-/g, '');
  }

  /**
   * 12桁のアカウントIDをハイフン区切り形式に変換
   * @param {string} accountId - 12桁のアカウントID
   * @returns {string} ハイフン区切り形式のアカウントID
   */
  static formatAccountId(accountId) {
    if (accountId.length === 12 && /^\d{12}$/.test(accountId)) {
      return `${accountId.slice(0, 4)}-${accountId.slice(
        4,
        8
      )}-${accountId.slice(8, 12)}`;
    }
    return accountId;
  }

  // エイリアスを適用すべきでない要素のセレクタ
  static EXCLUDE_SELECTORS = [
    // ARNを含む要素
    '[class*="arn"]',
    '[id*="arn"]',
    '[data-*="arn"]',
    // リソースIDを含む要素
    '[class*="resource-id"]',
    '[class*="resourceId"]',
    // コード表示要素
    'code',
    'pre',
    '.code-block',
    '.code-snippet',
    // CloudFormationテンプレート等
    '.template-editor',
    '.json-viewer',
    '.yaml-viewer',
  ];

  // 注意: TARGET_SELECTORS は使用しません（ブラウザ互換性のため）
  // 代わりに applyAliasesToPage で全要素をスキャンします

  /**
   * 要素がエイリアス適用対象外かどうかを判定
   * @param {Element} element - 判定対象の要素
   * @returns {boolean} 適用対象外の場合true
   */
  static isExcludedElement(element) {
    // 除外セレクタに一致する場合
    if (element.matches && element.matches(this.EXCLUDE_SELECTORS.join(','))) {
      return true;
    }

    // 親要素が除外対象の場合
    const excludedParent = element.closest(this.EXCLUDE_SELECTORS.join(','));
    if (excludedParent) {
      return true;
    }

    // ARNパターンを含むテキストの場合
    const text = element.textContent || '';
    if (text.includes('arn:aws:') || text.includes('arn:aws-cn:')) {
      return true;
    }

    return false;
  }

  /**
   * テキスト内のアカウントIDを検出してエイリアス付きテキストに変換
   * @param {string} text - 元のテキスト
   * @param {Object} aliasMap - アカウントIDとエイリアスのマッピング（12桁形式をキーとする）
   * @returns {string} エイリアスが適用されたテキスト
   */
  static applyAliasesToText(text, aliasMap) {
    // 既にエイリアスが適用されているかチェック
    if (text.includes('(') && text.includes(')')) {
      // エイリアスが既に含まれている可能性が高い場合は処理をスキップ
      const hasAlreadyProcessed = Object.values(aliasMap).some((alias) =>
        text.includes(`(${alias})`)
      );
      if (hasAlreadyProcessed) {
        return text; // 既に処理済みなのでそのまま返す
      }
    }

    return text.replace(this.ACCOUNT_ID_PATTERN, (match, accountId) => {
      // アカウントIDを12桁形式に正規化してエイリアスを検索
      const normalizedId = this.normalizeAccountId(accountId);
      const alias = aliasMap[normalizedId];

      if (alias) {
        // 元の表示形式を保持してエイリアスを追加
        return `${accountId} (${alias})`;
      }
      return match;
    });
  }

  /**
   * DOM要素にエイリアスを適用
   * @param {Element} element - 対象要素
   * @param {Object} aliasMap - アカウントIDとエイリアスのマッピング
   */
  static applyAliasToElement(element, aliasMap) {
    // 除外対象の場合は何もしない
    if (this.isExcludedElement(element)) {
      return;
    }

    // 既に処理済みの場合はスキップ
    if (element.dataset.aliasApplied === 'true') {
      return;
    }

    // エイリアススパンが既に存在する場合もスキップ
    if (element.querySelector('.aws-custom-alias')) {
      element.dataset.aliasApplied = 'true';
      return;
    }

    // テキストノードを直接含む要素の処理
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // 空白のみのテキストノードは除外
        if (!node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        // 親要素が除外対象の場合は除外
        if (this.isExcludedElement(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        // アカウントIDを含む場合のみ処理
        if (this.ACCOUNT_ID_PATTERN.test(node.nodeValue)) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_REJECT;
      },
    });

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    // テキストノードの更新
    textNodes.forEach((textNode) => {
      const originalText = textNode.nodeValue;
      const newText = this.applyAliasesToText(originalText, aliasMap);

      if (originalText !== newText) {
        // エイリアス部分をspan要素で囲むための処理
        // 12桁形式とハイフン区切り形式の両方に対応
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newText.replace(
          /(\d{4}-\d{4}-\d{4}|\d{12}) \(([^)]+)\)/g,
          '$1 <span class="aws-custom-alias">($2)</span>'
        );

        // テキストノードを新しいノードで置換
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });

    // 処理済みマークを付与
    element.dataset.aliasApplied = 'true';
  }

  /**
   * ページ全体にエイリアスを適用
   * @param {Object} aliasMap - アカウントIDとエイリアスのマッピング
   */
  static applyAliasesToPage(aliasMap) {
    try {
      // 安全なquerySelectorAll（セレクタエラーを避けるため）
      const allElements = document.querySelectorAll('*');
      let processedCount = 0;

      allElements.forEach((element) => {
        try {
          // 既に処理済みでない場合のみ処理
          if (element.dataset.aliasApplied !== 'true') {
            const text = element.textContent || '';

            // アカウントIDパターンを含む要素のみ処理
            if (this.ACCOUNT_ID_PATTERN.test(text)) {
              this.applyAliasToElement(element, aliasMap);
              processedCount++;
            }
          }
        } catch (error) {
          console.error('❌ Error processing element:', error, element);
        }
      });

      // ページタイトルも更新
      if (document.title) {
        const newTitle = this.applyAliasesToText(document.title, aliasMap);
        if (document.title !== newTitle) {
          document.title = newTitle;
        }
      }
    } catch (error) {
      console.error('❌ Critical error in applyAliasesToPage:', error);
    }
  }

  /**
   * 特定の要素配下のエイリアスをクリア
   * @param {Element} element - 対象要素
   */
  static clearAliasesFromElement(element) {
    // エイリアススパンを削除
    const aliasSpans = element.querySelectorAll('.aws-custom-alias');
    aliasSpans.forEach((span) => {
      // spanの親ノードからspan内容を削除し、アカウントIDのみ残す
      const parent = span.parentNode;
      if (parent) {
        // spanの直前のテキストノードを探してアカウントIDの後ろの空白とspanを削除
        let prevNode = span.previousSibling;
        if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
          const text = prevNode.textContent;
          // " (エイリアス)" パターンを削除
          prevNode.textContent = text.replace(/ \([^)]+\)$/, '');
        }
        span.remove();
      }
    });

    // 処理済みマークを削除
    const processedElements = element.querySelectorAll(
      '[data-alias-applied="true"]'
    );
    processedElements.forEach((el) => {
      delete el.dataset.aliasApplied;
    });
  }

  /**
   * URLからアカウントIDを抽出
   * @param {string} url - URL文字列
   * @returns {string|null} アカウントIDまたはnull
   */
  static extractAccountIdFromUrl(url) {
    // マルチセッションURLパターン: https://<アカウントID>-xxxxxxx.us-east-1.console.aws.amazon.com/console
    // または https://<アカウントID>-xxxxxxx.<リージョン>.console.aws.amazon.com/
    const multiSessionPattern =
      /https:\/\/(\d{12})-[\w-]+\.(?:[\w-]+\.)?console\.aws\.amazon\.com/;
    const match = url.match(multiSessionPattern);

    if (match && match[1]) {
      return match[1];
    }

    // 従来のAWSコンソールURL（マルチセッション無効時）からもアカウントIDを検出を試行
    // ただし、これは通常URLには含まれないため、基本的にnullを返す
    return null;
  }
}

// グローバルスコープに公開（content scriptから使用するため）
if (typeof window !== 'undefined') {
  window.AliasManager = AliasManager;
}
