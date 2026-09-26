import React from 'react';

interface DocumentIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * ExcelFileIcon: Matches the user's uploaded Microsoft Excel icon (`download excel.jpg`)
 * Features:
 * - Rounded square base with multi-toned Fluent green quadrants
 * - Overlapping front dark-green tile with rounded corners and drop shadow
 * - Crisp white capital letter "X"
 */
export const ExcelFileIcon: React.FC<DocumentIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 inline-block align-middle ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.18))">
        {/* Rounded square backplate */}
        <rect x="8" y="4" width="36" height="40" rx="8" fill="#107C41" />

        {/* 4 Multi-tone green quadrants (Fluent Excel design) */}
        {/* Top-Right: Lime Green */}
        <path
          d="M26 4H36C40.4183 4 44 7.58172 44 12V24H26V4Z"
          fill="#63D854"
        />
        {/* Top-Left: Emerald/Mint Green */}
        <path
          d="M8 12C8 7.58172 11.5817 4 16 4H26V24H8V12Z"
          fill="#33C481"
        />
        {/* Bottom-Right: Deep Rich Forest Green */}
        <path
          d="M26 24H44V36C44 40.4183 40.4183 44 36 44H26V24Z"
          fill="#145A32"
        />
        {/* Bottom-Left: Medium Forest Green */}
        <path
          d="M8 24H26V44H16C11.5817 44 8 40.4183 8 36V24Z"
          fill="#107C41"
        />

        {/* Soft gloss highlight across top edge */}
        <path
          d="M16 4.5H36C40.1421 4.5 43.5 7.85786 43.5 12V13H8.5V12C8.5 7.85786 11.8579 4.5 16 4.5Z"
          fill="white"
          fillOpacity="0.15"
        />

        {/* Overlapping Front Dark-Green Tile */}
        <g filter="drop-shadow(0 3px 4px rgba(0,0,0,0.38))">
          <rect
            x="4"
            y="13"
            width="22"
            height="22"
            rx="5"
            fill="#0E6835"
          />
          {/* Crisp White Letter 'X' */}
          <path
            d="M10.8 18.5L14.4 24L10.5 29.5H13.6L15.9 25.9L18.2 29.5H21.3L17.4 24L21 18.5H17.9L15.9 22.1L13.9 18.5H10.8Z"
            fill="#FFFFFF"
          />
        </g>
      </g>
    </svg>
  );
};

/**
 * PdfFileIcon: Matches the user's uploaded Adobe PDF icon (`imagespdf.png`)
 * Features:
 * - Rounded-corner white card body with distinct red outer stroke border
 * - Adobe Acrobat red ribbon loop knot (three-leaf figure-8 loop)
 * - Bold black/dark-slate "PDF" typography centered at the bottom
 */
export const PdfFileIcon: React.FC<DocumentIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 48 58"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 inline-block align-middle ${className}`}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.18))">
        {/* White Card with Red Rounded Border matching imagespdf.png */}
        <rect
          x="3.5"
          y="2.5"
          width="41"
          height="53"
          rx="7"
          fill="#FFFFFF"
          stroke="#E5252A"
          strokeWidth="3.2"
        />

        {/* Adobe Acrobat Red Ribbon Knot */}
        <path
          d="M24 10.5C21.8 10.5 19.8 12.8 19.8 16.4C19.8 21.8 28.5 30.2 32.2 32.6C33.8 33.6 36.4 33.6 37.3 31.4C38.2 29.2 37 27.2 34.3 25.6C30 23.2 20.6 23.2 15.8 26.3C12.2 28.7 11 31.9 12.6 34.1C14.2 36.3 17.4 35.7 20.6 33.5C23.8 30.9 26.7 26.2 24.8 17.2C24.4 13.6 23 10.5 24 10.5Z"
          stroke="#E5252A"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Bold "PDF" centered text */}
        <text
          x="24"
          y="48"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
          fontWeight="900"
          fontSize="10.5"
          fill="#262626"
          textAnchor="middle"
          letterSpacing="0.6"
        >
          PDF
        </text>
      </g>
    </svg>
  );
};

// Aliases for convenience
export const PdfIcon = PdfFileIcon;
export const ExcelIcon = ExcelFileIcon;
