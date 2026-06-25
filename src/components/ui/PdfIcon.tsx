import * as React from "react";

interface PdfIconProps extends React.SVGProps<SVGSVGElement> {}

const PdfIcon: React.FC<PdfIconProps> = (props) => (
  <svg
    viewBox="0 0 400 400"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    <g id="SVGRepo_bgCarrier" strokeWidth={0} />
    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
    <g id="SVGRepo_iconCarrier">
      <g id="pdf-icon">
        <path
          d="M325 105h-75a5 5 0 0 1-5-5V25a5 5 0 0 1 10 0v70h70a5 5 0 0 1 0 10"
        />
        <path
          d="M325 154.83a5 5 0 0 1-5-5v-47.76L247.93 30H100a20 20 0 0 0-20 20v98.17a5 5 0 0 1-10 0V50a30 30 0 0 1 30-30h150a5 5 0 0 1 3.54 1.46l75 75A5 5 0 0 1 330 100v49.83a5 5 0 0 1-5 5M300 380H100a30 30 0 0 1-30-30v-75a5 5 0 0 1 10 0v75a20 20 0 0 0 20 20h200a20 20 0 0 0 20-20v-75a5 5 0 0 1 10 0v75a30 30 0 0 1-30 30"
        />
        <path
          d="M275 280H125a5 5 0 0 1 0-10h150a5 5 0 0 1 0 10m-75 50h-75a5 5 0 0 1 0-10h75a5 5 0 0 1 0 10"
        />
        <path
          d="M325 280H75a30 30 0 0 1-30-30v-76.83a30 30 0 0 1 30-30h.2l250 1.66a30.09 30.09 0 0 1 29.81 30V250A30 30 0 0 1 325 280M75 153.17a20 20 0 0 0-20 20V250a20 20 0 0 0 20 20h250a20 20 0 0 0 20-20v-75.17a20.06 20.06 0 0 0-19.88-20l-250-1.66Z"
        />
        <path
          d="M145 236h-9.61v-53.32h21.84q9.34 0 13.85 4.71a16.37 16.37 0 0 1-.37 22.95 17.5 17.5 0 0 1-12.38 4.53H145Zm0-29.37h11.37q4.45 0 6.8-2.19a7.58 7.58 0 0 0 2.34-5.82 8 8 0 0 0-2.17-5.62q-2.17-2.34-7.83-2.34H145ZM183 236v-53.32h19.7q10.9 0 17.5 7.71t6.6 19q0 11.33-6.8 18.95T200.55 236Zm9.88-7.85h8a14.36 14.36 0 0 0 10.94-4.84q4.49-4.84 4.49-14.41a21.9 21.9 0 0 0-3.93-13.22 12.22 12.22 0 0 0-10.37-5.41h-9.14Zm52.71 7.85h-9.89v-53.32h33.71v8.24h-23.82v14.57h18.75v8h-18.75Z"
        />
      </g>
    </g>
  </svg>
);

export default PdfIcon;
