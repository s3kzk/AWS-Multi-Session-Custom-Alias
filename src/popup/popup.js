/**
 * AWS Multi-Session Custom Alias - Popup Script
 * ポップアップ画面の動作を制御
 */

(function () {
  'use strict';

  // DOM要素の参照
  const elements = {
    addAliasForm: document.getElementById('add-alias-form'),
    accountIdInput: document.getElementById('account-id'),
    aliasNameInput: document.getElementById('alias-name'),
    aliasList: document.getElementById('alias-list'),
    aliasCount: document.getElementById('alias-count'),
    emptyState: document.getElementById('empty-state'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    importFileInput: document.getElementById('import-file-input'),
    helpBtn: document.getElementById('help-btn'),
    messageContainer: document.getElementById('message-container'),
    confirmDialog: document.getElementById('confirm-dialog'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmOk: document.getElementById('confirm-ok'),
    confirmCancel: document.getElementById('confirm-cancel'),
    helpDialog: document.getElementById('help-dialog'),
    helpClose: document.getElementById('help-close'),
  };

  // 現在のエイリアスデータ
  let currentAliases = {};

  // 確認ダイアログのコールバック
  let confirmCallback = null;

  /**
   * 初期化処理
   */
  async function initialize() {
    try {
      // エイリアスデータを読み込み
      await loadAliases();

      // イベントリスナーを設定
      setupEventListeners();

      // UIを更新
      updateUI();

      console.log('Popup initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      showMessage('初期化に失敗しました', 'error');
    }
  }

  /**
   * エイリアスデータを読み込み
   */
  async function loadAliases() {
    currentAliases = await StorageManager.getAllAliases();
    console.log('Loaded aliases:', Object.keys(currentAliases).length);
  }

  /**
   * イベントリスナーを設定
   */
  function setupEventListeners() {
    // フォーム送信
    elements.addAliasForm.addEventListener('submit', handleAddAlias);

    // アカウントID入力の検証
    elements.accountIdInput.addEventListener('input', validateAccountId);

    // アクションボタン
    elements.exportBtn.addEventListener('click', handleExport);
    elements.importBtn.addEventListener('click', handleImport);
    elements.clearAllBtn.addEventListener('click', handleClearAll);

    // ファイル選択
    elements.importFileInput.addEventListener('change', handleFileImport);

    // ヘルプ
    elements.helpBtn.addEventListener('click', showHelp);
    elements.helpClose.addEventListener('click', hideHelp);

    // 確認ダイアログ
    elements.confirmOk.addEventListener('click', handleConfirmOk);
    elements.confirmCancel.addEventListener('click', hideConfirmDialog);

    // ダイアログの背景クリックで閉じる
    elements.confirmDialog.addEventListener('click', (e) => {
      if (e.target === elements.confirmDialog) {
        hideConfirmDialog();
      }
    });

    elements.helpDialog.addEventListener('click', (e) => {
      if (e.target === elements.helpDialog) {
        hideHelp();
      }
    });
  }

  /**
   * エイリアス追加の処理
   */
  async function handleAddAlias(event) {
    event.preventDefault();

    const inputAccountId = elements.accountIdInput.value.trim();
    const aliasName = elements.aliasNameInput.value.trim();

    // バリデーション
    if (!validateAccountIdFormat(inputAccountId)) {
      showMessage(
        'アカウントIDは12桁の数字またはハイフン区切り形式（1234-5678-9012）で入力してください',
        'error'
      );
      return;
    }

    if (!aliasName) {
      showMessage('エイリアス名を入力してください', 'error');
      return;
    }

    // アカウントIDを12桁形式に正規化（ストレージ用）
    const normalizedAccountId = normalizeAccountId(inputAccountId);

    try {
      // 既存のエイリアスがある場合は確認
      if (currentAliases[normalizedAccountId]) {
        const confirmed = await showConfirmDialog(
          'エイリアスの上書き',
          `アカウント ${inputAccountId} のエイリアス「${currentAliases[normalizedAccountId]}」を「${aliasName}」に変更しますか？`
        );

        if (!confirmed) {
          return;
        }
      }

      // エイリアスを保存（12桁形式をキーとして使用）
      await StorageManager.setAlias(normalizedAccountId, aliasName);
      currentAliases[normalizedAccountId] = aliasName;

      // フォームをリセット
      elements.addAliasForm.reset();

      // UIを更新
      updateUI();

      showMessage(
        `エイリアスを追加しました: ${accountId} → ${aliasName}`,
        'success'
      );
    } catch (error) {
      console.error('Failed to add alias:', error);
      showMessage('エイリアスの追加に失敗しました', 'error');
    }
  }

  /**
   * アカウントIDの検証（入力時の自動整形）
   */
  function validateAccountId(event) {
    const input = event.target;
    const value = input.value;

    // 数字とハイフンのみ許可
    const cleanValue = value.replace(/[^0-9-]/g, '');

    // 自動的にハイフン区切り形式に整形
    if (/^\d{4,}$/.test(cleanValue.replace(/-/g, ''))) {
      const digits = cleanValue.replace(/-/g, '');
      if (digits.length >= 4) {
        let formatted = digits.slice(0, 4);
        if (digits.length >= 8) {
          formatted += '-' + digits.slice(4, 8);
          if (digits.length >= 12) {
            formatted += '-' + digits.slice(8, 12);
          } else if (digits.length > 8) {
            formatted += '-' + digits.slice(8);
          }
        } else if (digits.length > 4) {
          formatted += '-' + digits.slice(4);
        }

        if (formatted !== value) {
          input.value = formatted;
          return;
        }
      }
    }

    if (cleanValue !== value) {
      input.value = cleanValue;
    }
  }

  /**
   * アカウントIDの形式を検証（12桁またはハイフン区切り形式）
   */
  function validateAccountIdFormat(accountId) {
    return /^(\d{12}|\d{4}-\d{4}-\d{4})$/.test(accountId);
  }

  /**
   * アカウントIDを12桁形式に正規化
   */
  function normalizeAccountId(accountId) {
    return accountId.replace(/-/g, '');
  }

  /**
   * 12桁のアカウントIDをハイフン区切り形式に変換
   */
  function formatAccountId(accountId) {
    if (accountId.length === 12 && /^\d{12}$/.test(accountId)) {
      return `${accountId.slice(0, 4)}-${accountId.slice(
        4,
        8
      )}-${accountId.slice(8, 12)}`;
    }
    return accountId;
  }

  /**
   * エイリアス削除の処理
   */
  async function handleDeleteAlias(accountId) {
    const aliasName = currentAliases[accountId];

    const confirmed = await showConfirmDialog(
      'エイリアスの削除',
      `アカウント ${accountId} のエイリアス「${aliasName}」を削除しますか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      await StorageManager.removeAlias(accountId);
      delete currentAliases[accountId];

      updateUI();
      showMessage(`エイリアスを削除しました: ${accountId}`, 'success');
    } catch (error) {
      console.error('Failed to delete alias:', error);
      showMessage('エイリアスの削除に失敗しました', 'error');
    }
  }

  /**
   * エイリアス編集の処理
   */
  async function handleEditAlias(accountId) {
    const currentAlias = currentAliases[accountId];
    const newAlias = prompt(
      `アカウント ${accountId} の新しいエイリアス名を入力してください:`,
      currentAlias
    );

    if (newAlias === null || newAlias === currentAlias) {
      return;
    }

    if (!newAlias.trim()) {
      showMessage('エイリアス名を入力してください', 'error');
      return;
    }

    try {
      await StorageManager.setAlias(accountId, newAlias.trim());
      currentAliases[accountId] = newAlias.trim();

      updateUI();
      showMessage(
        `エイリアスを更新しました: ${accountId} → ${newAlias.trim()}`,
        'success'
      );
    } catch (error) {
      console.error('Failed to edit alias:', error);
      showMessage('エイリアスの編集に失敗しました', 'error');
    }
  }

  /**
   * エクスポート処理
   */
  async function handleExport() {
    try {
      const data = await StorageManager.exportAliases();

      // ファイルとしてダウンロード
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `aws-aliases-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      showMessage('エイリアスデータをエクスポートしました', 'success');
    } catch (error) {
      console.error('Failed to export aliases:', error);
      showMessage('エクスポートに失敗しました', 'error');
    }
  }

  /**
   * インポート処理
   */
  function handleImport() {
    elements.importFileInput.click();
  }

  /**
   * ファイルインポート処理
   */
  async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await readFile(file);

      // 既存のデータがある場合は確認
      if (Object.keys(currentAliases).length > 0) {
        const confirmed = await showConfirmDialog(
          'データのインポート',
          '既存のエイリアス設定を上書きしますか？'
        );

        if (!confirmed) {
          return;
        }
      }

      await StorageManager.importAliases(text);
      await loadAliases();
      updateUI();

      showMessage('エイリアスデータをインポートしました', 'success');
    } catch (error) {
      console.error('Failed to import aliases:', error);
      showMessage(`インポートに失敗しました: ${error.message}`, 'error');
    } finally {
      // ファイル選択をクリア
      elements.importFileInput.value = '';
    }
  }

  /**
   * ファイルを読み込む
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () =>
        reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(file);
    });
  }

  /**
   * すべてクリア処理
   */
  async function handleClearAll() {
    if (Object.keys(currentAliases).length === 0) {
      showMessage('削除するエイリアスがありません', 'info');
      return;
    }

    const confirmed = await showConfirmDialog(
      'すべてのエイリアスを削除',
      `${
        Object.keys(currentAliases).length
      }件のエイリアスをすべて削除しますか？この操作は取り消せません。`
    );

    if (!confirmed) {
      return;
    }

    try {
      await StorageManager.clearAllAliases();
      currentAliases = {};

      updateUI();
      showMessage('すべてのエイリアスを削除しました', 'success');
    } catch (error) {
      console.error('Failed to clear all aliases:', error);
      showMessage('削除に失敗しました', 'error');
    }
  }

  /**
   * UIを更新
   */
  function updateUI() {
    const aliasEntries = Object.entries(currentAliases);
    const count = aliasEntries.length;

    // カウント表示を更新
    elements.aliasCount.textContent = `${count}件`;

    // 空状態の表示切り替え
    if (count === 0) {
      elements.emptyState.style.display = 'block';
      elements.aliasList.style.display = 'none';
    } else {
      elements.emptyState.style.display = 'none';
      elements.aliasList.style.display = 'block';
    }

    // エイリアス一覧を更新
    elements.aliasList.innerHTML = '';

    aliasEntries
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([accountId, aliasName]) => {
        const item = createAliasItem(accountId, aliasName);
        elements.aliasList.appendChild(item);
      });

    // アクションボタンの状態を更新
    elements.exportBtn.disabled = count === 0;
    elements.clearAllBtn.disabled = count === 0;
  }

  /**
   * エイリアス項目を作成
   */
  function createAliasItem(accountId, aliasName) {
    const item = document.createElement('div');
    item.className = 'alias-item';

    // アカウントIDをハイフン区切り形式で表示
    const displayAccountId = formatAccountId(accountId);

    item.innerHTML = `
      <div class="alias-info">
        <div class="alias-account-id">${displayAccountId}</div>
        <div class="alias-name">${escapeHtml(aliasName)}</div>
      </div>
      <div class="alias-actions">
        <button class="alias-action-btn edit" title="編集">✏️</button>
        <button class="alias-action-btn delete" title="削除">🗑️</button>
      </div>
    `;

    // イベントリスナーを設定
    const editBtn = item.querySelector('.edit');
    const deleteBtn = item.querySelector('.delete');

    editBtn.addEventListener('click', () => handleEditAlias(accountId));
    deleteBtn.addEventListener('click', () => handleDeleteAlias(accountId));

    return item;
  }

  /**
   * HTMLエスケープ
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * メッセージを表示
   */
  function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;

    elements.messageContainer.appendChild(message);

    // 3秒後に自動削除
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  /**
   * 確認ダイアログを表示
   */
  function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      elements.confirmTitle.textContent = title;
      elements.confirmMessage.textContent = message;
      elements.confirmDialog.style.display = 'flex';

      confirmCallback = resolve;
    });
  }

  /**
   * 確認ダイアログを非表示
   */
  function hideConfirmDialog() {
    elements.confirmDialog.style.display = 'none';
    if (confirmCallback) {
      confirmCallback(false);
      confirmCallback = null;
    }
  }

  /**
   * 確認ダイアログのOK処理
   */
  function handleConfirmOk() {
    elements.confirmDialog.style.display = 'none';
    if (confirmCallback) {
      confirmCallback(true);
      confirmCallback = null;
    }
  }

  /**
   * ヘルプを表示
   */
  function showHelp() {
    elements.helpDialog.style.display = 'flex';
  }

  /**
   * ヘルプを非表示
   */
  function hideHelp() {
    elements.helpDialog.style.display = 'none';
  }

  // 初期化実行
  document.addEventListener('DOMContentLoaded', initialize);
})();
