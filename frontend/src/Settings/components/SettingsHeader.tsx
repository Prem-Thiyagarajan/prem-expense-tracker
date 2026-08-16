// File: src/Settings/components/SettingsHeader.tsx

const SettingsHeader = () => {
  return (
    <div>
      <h1 className="font-heading font-extrabold text-[32px] leading-none tracking-[-0.02em] text-ink">
        Settings
      </h1>
      <p className="font-body font-medium text-[13px] text-muted mt-1.5">
        Categories, tags, accounts and imports.
      </p>
    </div>
  );
};

export default SettingsHeader;
