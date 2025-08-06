/**
 * Content Script - AWS Multi-Session Custom Alias
 * AWSコンソール上でカスタムエイリアスを表示する
 */

(function () {
  'use strict';

  // エイリアスマップのキャッシュ
  let aliasMap = {};

  // デバウンス用のタイマー
  let debounceTimer = null;

  // MutationObserverのインスタンス
  let observer = null;

  /**
   * ページタイプを検出してbodyにマーカーを付与
   */
  function detectAndMarkPageType() {
    const currentPath = window.location.pathname;
    const currentHost = window.location.hostname;

    // sessions/selectorページの検出
    if (
      currentPath.includes('/sessions/selector') ||
      currentHost.includes('signin.aws.amazon.com')
    ) {
      document.body.setAttribute('data-page', 'sessions-selector');
      console.log(
        '🎯 Detected sessions/selector page - marked for black text styling'
      );
    }
  }

  /**
   * 初期化処理
   */
  async function initialize() {
    try {
      // ページタイプの検出とマーキング
      detectAndMarkPageType();

      // ストレージからエイリアスを読み込み
      aliasMap = await StorageManager.getAllAliases();

      // 初回のエイリアス適用（ナビゲーション＋パスチェック）
      applyAliases();

      // DOM監視を開始
      startDOMObserver();

      // ストレージの変更を監視
      StorageManager.watchChanges((newAliases) => {
        console.log('Aliases updated from storage');
        aliasMap = newAliases;
        // ページ全体を再処理
        clearAllAliases();
        applyAliases();
      });

      // URLからアカウントIDを抽出して自動検出
      detectCurrentAccount();

      // ページ遷移を監視
      watchPageTransitions();
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  }

  /**
   * 現在のURLがエイリアス適用対象かどうかを判定
   */
  function shouldApplyAliases() {
    const currentPath = window.location.pathname;
    const currentHost = window.location.hostname;

    // console/home パスまたはsessions/selectorパスを許可
    const allowedPaths = [
      '/console/home',
      '/console/', // リダイレクト時の一時的なパス
      '/sessions/selector', // AWSマルチセッション選択画面
    ];

    const isAllowedPath = allowedPaths.some((path) =>
      currentPath.includes(path)
    );

    // signin.aws.amazon.comドメインの場合は特別扱い
    const isSigninDomain = currentHost.includes('signin.aws.amazon.com');

    return isAllowedPath || isSigninDomain;
  }

  /**
   * ナビゲーションバーのみにエイリアスを適用
   */
  function applyAliasesToNavigation() {
    if (Object.keys(aliasMap).length === 0) {
      return;
    }

    // AWSナビゲーションバーの主要セレクタ
    const navigationSelectors = [
      '[data-testid="awsc-nav-account-menu-button"]',
      '[data-testid="account-menu-button"]',
      '.nav-menu-account-name',
      '.awsui-context-top-navigation',
      '#consoleNavHeader',
      '.awsc-nav-header',
      '[aria-label*="Account"]',
      '[role="banner"]', // ヘッダー全体
      // 現在のセッション関連
      '.current-session',
      '.session-info',
      '.session-panel',
      '.account-session',
      '[data-testid*="session"]',
      '[data-testid*="account-info"]',
      '[class*="session"]',
      '[class*="account-id"]',
      // AWSUIコンポーネント
      '.awsui-util-container',
      '.awsui-util-content',
      '[data-awsui-util-type]',
      // マルチセッション関連
      '.multi-session',
      '.session-switcher',
      '.account-switcher',
      // セッション選択画面特有のセレクタ
      '.session-option',
      '.session-item',
      '.account-info',
      '.account-card',
      '.session-card',
      '[data-testid*="session-option"]',
      '[class*="session-list"]',
      '[class*="account-list"]',
    ];

    let processedCount = 0;

    navigationSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          if (element.dataset.aliasApplied !== 'true') {
            const text = element.textContent || '';
            if (AliasManager.ACCOUNT_ID_PATTERN.test(text)) {
              AliasManager.applyAliasToElement(element, aliasMap);
              processedCount++;
            }
          }
        });
      } catch (error) {
        console.warn(
          '⚠️ Error processing navigation selector:',
          selector,
          error
        );
      }
    });

    // 特別に「現在のセッション」セクションを詳細処理
    // これは右上のセッション情報パネル用
    const sessionPanelSelectors = [
      // より具体的なセッションパネルのセレクタ
      '[data-testid*="session-panel"]',
      '[id*="session"]',
      '[class*="session-panel"]',
      // 汎用的なアカウント情報セレクタ
      '*[class*="account"] *',
      '*[id*="account"] *',
      // セッション選択画面用の追加セレクタ
      '.account-container',
      '.session-container',
      '[role="option"]',
      '[role="listitem"]',
      '.account-entry',
      '.session-entry',
      '[data-account-id]',
      '[aria-label*="Account"]',
      '[aria-describedby*="account"]',
    ];

    sessionPanelSelectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          if (element.dataset.aliasApplied !== 'true') {
            const text = element.textContent || '';
            // 登録済みアカウントIDまたは正規表現パターンでマッチするかチェック
            const hasRegisteredAccountId = Object.keys(aliasMap).some(
              (accountId) => {
                const formattedId = AliasManager.formatAccountId(accountId);
                return text.includes(accountId) || text.includes(formattedId);
              }
            );

            if (
              hasRegisteredAccountId ||
              AliasManager.ACCOUNT_ID_PATTERN.test(text)
            ) {
              AliasManager.applyAliasToElement(element, aliasMap);
              processedCount++;
            }
          }
        });
      } catch (error) {
        console.warn(
          '⚠️ Error processing session panel selector:',
          selector,
          error
        );
      }
    });
  }

  /**
   * エイリアスを適用
   */
  function applyAliases() {
    if (Object.keys(aliasMap).length === 0) {
      return;
    }

    // デバウンス処理
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      // 常にナビゲーションバーには適用
      applyAliasesToNavigation();

      // console/homeページの場合はページ全体にも適用
      if (shouldApplyAliases()) {
        AliasManager.applyAliasesToPage(aliasMap);
      } else {
      }
    }, 100);
  }

  /**
   * すべてのエイリアスをクリア
   */
  function clearAllAliases() {
    AliasManager.clearAliasesFromElement(document.body);
  }

  /**
   * ナビゲーション以外のページコンテンツのエイリアスをクリア
   */
  function clearPageContentAliases() {
    const navigationSelectors = [
      '[data-testid="awsc-nav-account-menu-button"]',
      '[data-testid="account-menu-button"]',
      '.nav-menu-account-name',
      '.awsui-context-top-navigation',
      '#consoleNavHeader',
      '.awsc-nav-header',
      '[role="banner"]',
      // 現在のセッション関連
      '.current-session',
      '.session-info',
      '.session-panel',
      '.account-session',
      '[data-testid*="session"]',
      '[data-testid*="account-info"]',
      '[class*="session"]',
      '[class*="account-id"]',
      // AWSUIコンポーネント
      '.awsui-util-container',
      '.awsui-util-content',
      '[data-awsui-util-type]',
      // マルチセッション関連
      '.multi-session',
      '.session-switcher',
      '.account-switcher',
      // セッション選択画面特有のセレクタ
      '.session-option',
      '.session-item',
      '.account-info',
      '.account-card',
      '.session-card',
      '[data-testid*="session-option"]',
      '[class*="session-list"]',
      '[class*="account-list"]',
      '.account-container',
      '.session-container',
      '[role="option"]',
      '[role="listitem"]',
      '.account-entry',
      '.session-entry',
      '[data-account-id]',
      '[aria-label*="Account"]',
      '[aria-describedby*="account"]',
    ];

    // ナビゲーション要素以外のエイリアスをクリア
    const allAliasElements = document.querySelectorAll('.aws-custom-alias');
    allAliasElements.forEach((aliasElement) => {
      // ナビゲーション要素の子要素かどうかをチェック
      const isInNavigation = navigationSelectors.some((selector) => {
        const navElements = document.querySelectorAll(selector);
        return Array.from(navElements).some((navElement) =>
          navElement.contains(aliasElement)
        );
      });

      // ナビゲーション内でなければ削除
      if (!isInNavigation) {
        const parent = aliasElement.parentNode;
        if (parent) {
          let prevNode = aliasElement.previousSibling;
          if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
            prevNode.textContent = prevNode.textContent.replace(
              / \([^)]+\)$/,
              ''
            );
          }
          aliasElement.remove();
        }
      }
    });

    // ナビゲーション以外の処理済みマークを削除
    const processedElements = document.querySelectorAll(
      '[data-alias-applied="true"]'
    );
    processedElements.forEach((element) => {
      const isInNavigation = navigationSelectors.some((selector) => {
        const navElements = document.querySelectorAll(selector);
        return Array.from(navElements).some(
          (navElement) => navElement.contains(element) || navElement === element
        );
      });

      if (!isInNavigation) {
        delete element.dataset.aliasApplied;
      }
    });
  }

  /**
   * DOM変更の監視を開始
   */
  function startDOMObserver() {
    // 既存のオブザーバーがあれば停止
    if (observer) {
      observer.disconnect();
    }

    // MutationObserverの設定
    const observerConfig = {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    };

    // オブザーバーのコールバック
    const observerCallback = (mutations) => {
      let shouldApplyAliases = false;

      for (const mutation of mutations) {
        // テキストの変更
        if (mutation.type === 'characterData') {
          const text = mutation.target.nodeValue || '';
          if (AliasManager.ACCOUNT_ID_PATTERN.test(text)) {
            console.log(
              '🔍 Text change detected with account ID:',
              text.substring(0, 50)
            );
            shouldApplyAliases = true;
            break;
          }
        }

        // ノードの追加
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = node.textContent || '';
              if (AliasManager.ACCOUNT_ID_PATTERN.test(text)) {
                console.log(
                  '🔍 New element detected with account ID:',
                  text.substring(0, 50)
                );
                shouldApplyAliases = true;
                break;
              }
            }
          }
        }
      }

      if (shouldApplyAliases) {
        console.log('🚀 Triggering alias application due to DOM changes');
        applyAliases();
      }
    };

    // オブザーバーを作成して開始
    observer = new MutationObserver(observerCallback);
    observer.observe(document.body, observerConfig);
  }

  /**
   * 現在のアカウントを検出
   */
  function detectCurrentAccount() {
    const currentUrl = window.location.href;
    const accountId = AliasManager.extractAccountIdFromUrl(currentUrl);
  }

  /**
   * ページ遷移を監視
   */
  function watchPageTransitions() {
    // pushState/replaceStateの監視
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(history, arguments);
      handlePageTransition();
    };

    history.replaceState = function () {
      originalReplaceState.apply(history, arguments);
      handlePageTransition();
    };

    // popstateイベントの監視
    window.addEventListener('popstate', handlePageTransition);
  }

  /**
   * ページ遷移時の処理
   */
  function handlePageTransition() {
    // ページタイプの再検出とマーキング
    detectAndMarkPageType();

    // URLから現在のアカウントを再検出
    detectCurrentAccount();

    // エイリアスを再適用（ナビゲーション + パスチェック）
    setTimeout(() => {
      // ページコンテンツのエイリアスをクリア（console/home以外の場合）
      if (!shouldApplyAliases()) {
        // ナビゲーション以外のエイリアスをクリア
        clearPageContentAliases();
      }

      // エイリアスを適用（ナビゲーションは常に、ページ全体は条件付き）
      applyAliases();
    }, 500);
  }

  /**
   * 特定の要素に対するエイリアス適用をフック
   * AWSコンソールの動的更新に対応
   */
  function hookSpecificElements() {
    // ナビゲーションバーのアカウントメニュー
    const accountMenuSelector = '[data-testid="awsc-nav-account-menu-button"]';
    const accountMenuObserver = new MutationObserver((mutations) => {
      const accountMenu = document.querySelector(accountMenuSelector);
      if (accountMenu) {
        AliasManager.applyAliasToElement(accountMenu, aliasMap);
      }
    });

    const accountMenu = document.querySelector(accountMenuSelector);
    if (accountMenu) {
      accountMenuObserver.observe(accountMenu.parentElement, {
        childList: true,
        subtree: true,
      });
    }

    // セッションドロップダウン
    document.addEventListener('click', (event) => {
      // ドロップダウンが開かれた時の処理
      setTimeout(() => {
        const dropdownContent = document.querySelector(
          '.session-menu-content, [role="menu"]'
        );
        if (dropdownContent) {
          AliasManager.applyAliasToElement(dropdownContent, aliasMap);
        }
      }, 100);
    });
  }

  /**
   * 詳細なデバッグ情報を出力
   */
  function debugInfo() {
    const currentUrl = window.location.href;
    const detectedAccountId = AliasManager.extractAccountIdFromUrl(currentUrl);

    console.group('🔍 AWS Multi-Session Custom Alias - DETAILED DEBUG');

    // 基本情報
    console.log('📍 Current URL:', currentUrl);
    console.log(
      '🏢 Detected Account ID from URL:',
      detectedAccountId || 'None'
    );
    console.log('📝 All Loaded Aliases:', aliasMap);
    console.log('🔧 Extension Status:', {
      aliasCount: Object.keys(aliasMap).length,
      observerActive: !!observer,
      pageReadyState: document.readyState,
    });

    // アカウントID検出テスト
    console.group('🔍 Account ID Detection Test');
    const testPatterns = [
      '1111-1111-1111',
      '111111111111',
      'アカウント ID: 1111-1111-1111',
      '1111-1111-1111',
      '123456789012',
    ];

    testPatterns.forEach((pattern) => {
      const matches = AliasManager.ACCOUNT_ID_PATTERN.test(pattern);
      console.log(
        `Pattern "${pattern}": ${matches ? '✅ MATCH' : '❌ NO MATCH'}`
      );
    });
    console.groupEnd();

    // ページ内のアカウントID検索
    console.group('🔍 Account IDs Found on Page');
    const allText = document.body.textContent || '';
    const foundAccountIds = allText.match(AliasManager.ACCOUNT_ID_PATTERN);
    if (foundAccountIds) {
      console.log('Found Account IDs:', [...new Set(foundAccountIds)]);
      foundAccountIds.forEach((id) => {
        const normalized = AliasManager.normalizeAccountId(id);
        const hasAlias = !!aliasMap[normalized];
        console.log(
          `  ${id} (normalized: ${normalized}) -> Alias: ${
            hasAlias ? aliasMap[normalized] : 'NOT SET'
          }`
        );
      });
    } else {
      console.log('❌ No Account IDs found on page');
    }
    console.groupEnd();

    // DOM要素の詳細分析
    console.group('🎯 DOM Elements Analysis');

    // 特定のテキストを含む要素を検索
    const elementsWithAccountId = [];
    document.querySelectorAll('*').forEach((el) => {
      const text = el.textContent || '';
      if (text.includes('1111-1111-1111') || text.includes('111111111111')) {
        elementsWithAccountId.push({
          element: el,
          tagName: el.tagName.toLowerCase(),
          className: el.className,
          id: el.id,
          text: text.trim().substring(0, 100),
          processed: el.dataset.aliasApplied === 'true',
        });
      }
    });

    console.log(
      `Found ${elementsWithAccountId.length} elements containing account ID:`
    );
    elementsWithAccountId.forEach((item, index) => {
      console.log(
        `  ${index + 1}. <${item.tagName}${
          item.className ? ' class="' + item.className + '"' : ''
        }${item.id ? ' id="' + item.id + '"' : ''}>`
      );
      console.log(`     Text: "${item.text}..."`);
      console.log(`     Processed: ${item.processed ? '✅ YES' : '❌ NO'}`);
      console.log(`     Element:`, item.element);
    });
    console.groupEnd();

    console.groupEnd();
  }

  // より詳細なアカウントID検索機能
  function findAccountIdElements() {
    console.group('🔍 SEARCHING FOR ACCOUNT ID ELEMENTS');

    const accountIdRegex = /(\d{4}-\d{4}-\d{4}|\d{12})/g;
    const results = [];

    // すべての要素をチェック
    document.querySelectorAll('*').forEach((element) => {
      const text = element.textContent || '';
      const matches = text.match(accountIdRegex);

      if (matches) {
        // 直接の子のテキストノードのみをチェック
        let hasDirectText = false;
        for (let node of element.childNodes) {
          if (
            node.nodeType === Node.TEXT_NODE &&
            accountIdRegex.test(node.textContent)
          ) {
            hasDirectText = true;
            break;
          }
        }

        results.push({
          element,
          tagName: element.tagName.toLowerCase(),
          className: element.className,
          id: element.id,
          matches: [...new Set(matches)],
          directText: hasDirectText,
          processed: element.dataset.aliasApplied === 'true',
          excluded: AliasManager.isExcludedElement(element),
        });
      }
    });

    console.log(`Found ${results.length} elements with account IDs:`);
    results.forEach((item, index) => {
      console.group(`Element ${index + 1}: <${item.tagName}>`);
      console.log('Element:', item.element);
      console.log('Class:', item.className || 'none');
      console.log('ID:', item.id || 'none');
      console.log('Account IDs:', item.matches);
      console.log('Has direct text:', item.directText ? '✅' : '❌');
      console.log('Already processed:', item.processed ? '✅' : '❌');
      console.log('Excluded:', item.excluded ? '🚫 YES' : '✅ NO');
      console.groupEnd();
    });

    console.groupEnd();
    return results;
  }

  // ページ読み込み完了を待って初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    // 既に読み込み完了している場合
    initialize();
  }

  // 追加の初期化（AWSコンソールの遅延読み込みに対応）
  setTimeout(() => {
    hookSpecificElements();
    applyAliases();
  }, 2000);

  // さらに積極的な定期実行（ナビゲーション＋パスチェック）
  setInterval(() => {
    if (Object.keys(aliasMap).length > 0) {
      applyAliases();
    }
  }, 3000);
})();
