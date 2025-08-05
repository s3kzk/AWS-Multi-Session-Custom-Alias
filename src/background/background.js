/**
 * AWS Multi-Session Custom Alias - Background Script (Service Worker)
 * バックグラウンドで動作するサービスワーカー
 */

// 拡張機能のインストール・更新時の処理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // 初回インストール時の処理
    initializeExtension();
  } else if (details.reason === 'update') {
    // アップデート時の処理
    handleExtensionUpdate(details.previousVersion);
  }
});

/**
 * 拡張機能の初期化処理
 */
async function initializeExtension() {
  try {
    // 初期設定値があれば設定
    const existingAliases = await chrome.storage.local.get([
      'aws_account_aliases',
    ]);

    if (!existingAliases.aws_account_aliases) {
      // 必要に応じてデフォルトの設定を保存
      await chrome.storage.local.set({
        aws_account_aliases: {},
        extension_settings: {
          version: '1.0.0',
          initialized: true,
          installedAt: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

/**
 * 拡張機能のアップデート処理
 */
async function handleExtensionUpdate(previousVersion) {
  try {
    // バージョン固有の移行処理があれば実行
    // 例: v1.0.0からv1.1.0への移行

    // 設定の更新
    await chrome.storage.local.set({
      extension_settings: {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        previousVersion: previousVersion,
      },
    });
  } catch (error) {
    console.error('Failed to handle extension update:', error);
  }
}

/**
 * ポップアップやコンテンツスクリプトからのメッセージを処理
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getAliases':
      handleGetAliases(request, sendResponse);
      return true; // 非同期レスポンス

    case 'setAlias':
      handleSetAlias(request, sendResponse);
      return true;

    case 'removeAlias':
      handleRemoveAlias(request, sendResponse);
      return true;

    case 'clearAllAliases':
      handleClearAllAliases(request, sendResponse);
      return true;

    case 'exportAliases':
      handleExportAliases(request, sendResponse);
      return true;

    case 'importAliases':
      handleImportAliases(request, sendResponse);
      return true;

    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * エイリアス取得の処理
 */
async function handleGetAliases(request, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['aws_account_aliases']);
    sendResponse({
      success: true,
      data: result.aws_account_aliases || {},
    });
  } catch (error) {
    console.error('Failed to get aliases:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * エイリアス設定の処理
 */
async function handleSetAlias(request, sendResponse) {
  try {
    const { accountId, alias } = request;

    if (!accountId || !alias) {
      throw new Error('Account ID and alias are required');
    }

    // 既存のエイリアスを取得
    const result = await chrome.storage.local.get(['aws_account_aliases']);
    const aliases = result.aws_account_aliases || {};

    // エイリアスを設定
    aliases[accountId] = alias;

    // 保存
    await chrome.storage.local.set({ aws_account_aliases: aliases });

    sendResponse({
      success: true,
      data: { accountId, alias },
    });
  } catch (error) {
    console.error('Failed to set alias:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * エイリアス削除の処理
 */
async function handleRemoveAlias(request, sendResponse) {
  try {
    const { accountId } = request;

    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // 既存のエイリアスを取得
    const result = await chrome.storage.local.get(['aws_account_aliases']);
    const aliases = result.aws_account_aliases || {};

    // エイリアスを削除
    delete aliases[accountId];

    // 保存
    await chrome.storage.local.set({ aws_account_aliases: aliases });

    sendResponse({
      success: true,
      data: { accountId },
    });
  } catch (error) {
    console.error('Failed to remove alias:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * 全エイリアス削除の処理
 */
async function handleClearAllAliases(request, sendResponse) {
  try {
    await chrome.storage.local.set({ aws_account_aliases: {} });

    sendResponse({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('Failed to clear all aliases:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * エイリアスエクスポートの処理
 */
async function handleExportAliases(request, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['aws_account_aliases']);
    const aliases = result.aws_account_aliases || {};

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      aliases: aliases,
    };

    sendResponse({
      success: true,
      data: JSON.stringify(exportData, null, 2),
    });
  } catch (error) {
    console.error('Failed to export aliases:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * エイリアスインポートの処理
 */
async function handleImportAliases(request, sendResponse) {
  try {
    const { data } = request;

    if (!data) {
      throw new Error('Import data is required');
    }

    let importData;
    try {
      importData = JSON.parse(data);
    } catch (parseError) {
      throw new Error('Invalid JSON format');
    }

    // データ形式の検証
    let aliases;
    if (importData.aliases && typeof importData.aliases === 'object') {
      // v1.0.0形式
      aliases = importData.aliases;
    } else if (typeof importData === 'object') {
      // レガシー形式（直接エイリアスオブジェクト）
      aliases = importData;
    } else {
      throw new Error('Invalid data format');
    }

    // エイリアスの検証
    for (const [accountId, alias] of Object.entries(aliases)) {
      if (!/^\d{12}$/.test(accountId)) {
        throw new Error(`Invalid account ID: ${accountId}`);
      }
      if (typeof alias !== 'string' || !alias.trim()) {
        throw new Error(`Invalid alias for account ${accountId}`);
      }
    }

    // インポート実行
    await chrome.storage.local.set({ aws_account_aliases: aliases });

    sendResponse({
      success: true,
      data: aliases,
    });
  } catch (error) {
    console.error('Failed to import aliases:', error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * タブの更新を監視
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // AWSコンソールのタブが更新された場合
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    tab.url.includes('console.aws.amazon.com')
  ) {
    // 必要に応じてコンテンツスクリプトに通知
    chrome.tabs
      .sendMessage(tabId, {
        action: 'tabUpdated',
        url: tab.url,
      })
      .catch(() => {
        // コンテンツスクリプトが未読み込みの場合のエラーを無視
      });
  }
});

/**
 * ストレージ変更の監視
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.aws_account_aliases) {
    // 全てのAWSコンソールタブに変更を通知
    chrome.tabs.query({ url: '*://*.console.aws.amazon.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            action: 'aliasesChanged',
            aliases: changes.aws_account_aliases.newValue || {},
          })
          .catch(() => {
            // コンテンツスクリプトが未読み込みの場合のエラーを無視
          });
      });
    });
  }
});

/**
 * コンテキストメニューの追加（必要に応じて）
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aws-alias-settings',
    title: 'AWS Alias設定を開く',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.console.aws.amazon.com/*'],
  });
});

/**
 * コンテキストメニューのクリック処理
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'aws-alias-settings') {
    // ポップアップを開く（拡張機能のアイコンをクリックしたのと同じ動作）
    chrome.action.openPopup();
  }
});
