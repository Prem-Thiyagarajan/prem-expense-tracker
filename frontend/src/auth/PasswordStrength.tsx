import React from 'react';

interface ValidationCriteria {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  specialChar: boolean;
}

interface Props {
  password?: string;
}

const Requirement: React.FC<{ text: string; met: boolean }> = ({ text, met }) => (
    <span
        className={[
            "inline-flex items-center rounded-full border-1.5 border-line px-3 py-1.5 font-body font-bold text-[11px] text-[#1E1B16] whitespace-nowrap transition-colors duration-chip",
            met ? "bg-candy-mint" : "bg-hair",
        ].join(" ")}
    >
        {met ? '✓ ' : '○ '}{text}
    </span>
);

const PasswordStrength: React.FC<Props> = ({ password = '' }) => {
    const criteria: ValidationCriteria = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        specialChar: /[\W_]/.test(password),
    };

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            <Requirement text="8+ characters" met={criteria.length} />
            <Requirement text="Uppercase letter" met={criteria.uppercase} />
            <Requirement text="Lowercase letter" met={criteria.lowercase} />
            <Requirement text="Number" met={criteria.number} />
            <Requirement text="Special character" met={criteria.specialChar} />
        </div>
    );
};

export default PasswordStrength;
