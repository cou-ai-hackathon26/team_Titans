import React from 'react';

export type ActiveTab = 'scanner' | 'blister' | 'caregiver' | 'dgda';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onNewScan: () => void;
  hasActivePrescription: boolean;
  lang: 'en' | 'bn';
  onChangeLang: (lang: 'en' | 'bn') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onNewScan,
  hasActivePrescription,
  lang,
  onChangeLang,
}) => {
  const navItems: Array<{ id: ActiveTab; labelEn: string; labelBn: string }> = [
    { id: 'scanner', labelEn: 'Prescription', labelBn: 'প্রেসক্রিপশন' },
    { id: 'blister', labelEn: 'Check Strip', labelBn: 'পাতা যাচাই' },
    { id: 'caregiver', labelEn: 'Schedule', labelBn: 'সময়সূচী' },
    { id: 'dgda', labelEn: 'Medicines', labelBn: 'ওষুধ তালিকা' },
  ];

  return (
    <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200/60">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('scanner')}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 cursor-pointer"
        >
          OshudhGuard
        </button>

        {/* Zone 2: 4 Clean Navigation Links */}
        <nav aria-label="Primary Views" className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                  isActive ? 'text-teal-800' : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                {lang === 'bn' ? item.labelBn : item.labelEn}
                {isActive && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-700" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Clean Action (Language toggle when landing, New Scan when active) */}
        <div className="shrink-0">
          {hasActivePrescription ? (
            <button
              type="button"
              onClick={onNewScan}
              className="px-3.5 py-1.5 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {lang === 'bn' ? 'নতুন স্ক্যান' : 'New Scan'}
            </button>
          ) : (
            <div
              role="group"
              aria-label="Language"
              className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs"
            >
              <button
                type="button"
                aria-pressed={lang === 'en'}
                onClick={() => onChangeLang('en')}
                className={`px-2 py-1 font-medium rounded-md cursor-pointer ${
                  lang === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                aria-pressed={lang === 'bn'}
                onClick={() => onChangeLang('bn')}
                className={`px-2 py-1 font-medium font-bangla rounded-md cursor-pointer ${
                  lang === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                বাংলা
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compact Mobile Navigation Row */}
      <nav
        aria-label="Mobile Views"
        className="md:hidden border-t border-slate-100 px-4 flex items-center justify-between overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectTab(item.id)}
              className={`py-2 px-2 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                isActive ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-400'
              }`}
            >
              {lang === 'bn' ? item.labelBn : item.labelEn}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
