/**
 * ストレージ管理ユーティリティ
 * Chrome拡張機能のローカルストレージを使用してエイリアスデータを管理
 */

const STORAGE_KEY = 'aws_account_aliases';

class StorageManager {
  /**
   * すべてのエイリアスを取得
   * @returns {Promise<Object>} アカウントIDをキー、エイリアス名を値とするオブジェクト
   */
  static async getAllAliases() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || {});
      });
    });
  }

  /**
   * 特定のアカウントIDのエイリアスを取得
   * @param {string} accountId - AWSアカウントID（12桁）
   * @returns {Promise<string|null>} エイリアス名またはnull
   */
  static async getAlias(accountId) {
    const aliases = await this.getAllAliases();
    return aliases[accountId] || null;
  }

  /**
   * エイリアスを保存
   * @param {string} accountId - AWSアカウントID（12桁）
   * @param {string} alias - エイリアス名
   * @returns {Promise<void>}
   */
  static async setAlias(accountId, alias) {
    const aliases = await this.getAllAliases();
    aliases[accountId] = alias;

    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: aliases }, resolve);
    });
  }

  /**
   * エイリアスを削除
   * @param {string} accountId - AWSアカウントID（12桁）
   * @returns {Promise<void>}
   */
  static async removeAlias(accountId) {
    const aliases = await this.getAllAliases();
    delete aliases[accountId];

    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: aliases }, resolve);
    });
  }

  /**
   * すべてのエイリアスをクリア
   * @returns {Promise<void>}
   */
  static async clearAllAliases() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([STORAGE_KEY], resolve);
    });
  }

  /**
   * エイリアスデータをエクスポート
   * @returns {Promise<string>} JSON形式のエイリアスデータ
   */
  static async exportAliases() {
    const aliases = await this.getAllAliases();
    return JSON.stringify(aliases, null, 2);
  }

  /**
   * エイリアスデータをインポート
   * @param {string} jsonData - JSON形式のエイリアスデータ
   * @returns {Promise<void>}
   */
  static async importAliases(jsonData) {
    try {
      const aliases = JSON.parse(jsonData);

      // バリデーション: オブジェクトであることを確認
      if (typeof aliases !== 'object' || aliases === null) {
        throw new Error('Invalid alias data format');
      }

      // バリデーション: すべてのキーが12桁の数字であることを確認
      for (const accountId in aliases) {
        if (!/^\d{12}$/.test(accountId)) {
          throw new Error(`Invalid account ID: ${accountId}`);
        }
      }

      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: aliases }, resolve);
      });
    } catch (error) {
      throw new Error(`Failed to import aliases: ${error.message}`);
    }
  }

  /**
   * ストレージの変更を監視
   * @param {Function} callback - 変更時に呼ばれるコールバック関数
   */
  static watchChanges(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        callback(changes[STORAGE_KEY].newValue || {});
      }
    });
  }
}

// グローバルスコープに公開（content scriptから使用するため）
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
