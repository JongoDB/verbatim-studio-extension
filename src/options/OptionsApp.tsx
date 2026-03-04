import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle } from 'lucide-react';
import { getSettings, saveSettings } from '@/lib/storage';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { ExtensionSettings } from '@/types';

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [saved, setSaved] = useState(false);
  useDarkMode();

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return null;

  return (
    <div className="max-w-xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl font-bold text-verbatim-500">V</span>
        <div>
          <h1 className="text-xl font-bold">Verbatim Studio Extension</h1>
          <p className="text-sm text-gray-500">Settings</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Backend Port */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-verbatim-500" />
            Connection
          </h2>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
              Backend Port
            </label>
            <input
              className="input w-40"
              type="number"
              value={settings.backendPort}
              onChange={(e) =>
                setSettings({ ...settings, backendPort: parseInt(e.target.value) || 52780 })
              }
            />
            <p className="text-xs text-gray-400 mt-1">
              Default: 52780. Change only if you've configured a custom port.
            </p>
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">
              Theme
            </label>
            <select
              className="input w-40"
              value={settings.darkMode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  darkMode: e.target.value as ExtensionSettings['darkMode'],
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) =>
                setSettings({ ...settings, notificationsEnabled: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm">
              Show notifications when jobs complete
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoReconnect}
              onChange={(e) =>
                setSettings({ ...settings, autoReconnect: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm">
              Auto-reconnect when connection is lost
            </span>
          </label>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button className="btn-primary flex items-center gap-2" onClick={handleSave}>
            <Save className="w-4 h-4" />
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
