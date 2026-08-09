import { type ReactNode } from 'react';

// 全站统一白色卡片样式 — 浅灰投影 + 1px 边框
// 用户指定: rgba(0, 0, 0, 0.04) 0px 1px 3px, rgba(0, 0, 0, 0.08) 0px 0px 40px 20px
export const CARD_SHADOW = '0 1px 3px rgba(0, 0, 0, 0.04), 0 0 40px 20px rgba(0, 0, 0, 0.08)';

interface CardProps {
  children: ReactNode;
  style?: React.CSSProperties;
  noPadding?: boolean;
  onClick?: () => void;
}

export function Card({ children, style, noPadding, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF',
        borderRadius: 12,
        boxShadow: CARD_SHADOW,
        padding: noPadding ? 0 : '20px 24px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
