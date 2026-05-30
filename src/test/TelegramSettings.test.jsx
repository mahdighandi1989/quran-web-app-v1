import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TelegramSettings from '../components/TelegramSettings.jsx';
import { DEFAULT_TELEGRAM } from '../lib/telegram.js';

const makeConfig = () => JSON.parse(JSON.stringify(DEFAULT_TELEGRAM));
const baseProps = (over = {}) => ({
  config: makeConfig(), setConfig: () => {}, loaded: true, user: { displayName: 'Test' }, ...over,
});

describe('TelegramSettings panel', () => {
  it('shows a loading state until config is loaded', () => {
    render(<TelegramSettings {...baseProps({ loaded: false })} />);
    expect(screen.getByText(/در حال بارگذاری تنظیمات از سرور/)).toBeInTheDocument();
  });

  it('renders the heading, notification rows and reminder input once loaded', () => {
    render(<TelegramSettings {...baseProps()} />);
    expect(screen.getByText(/تعامل تلگرام/)).toBeInTheDocument();
    expect(screen.getByText(/کدام اعلان‌ها ارسال شوند/)).toBeInTheDocument();
    expect(screen.getByText('نتیجهٔ آزمون')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/متن یادآوری/)).toBeInTheDocument();
  });

  it('shows the bot-token security warning (server-only storage)', () => {
    render(<TelegramSettings {...baseProps()} />);
    expect(screen.getByText(/توکن یک سِکرت است/)).toBeInTheDocument();
  });

  it('toggling master enable calls setConfig', () => {
    const setConfig = vi.fn();
    render(<TelegramSettings {...baseProps({ setConfig })} />);
    fireEvent.click(screen.getByLabelText(/فعال‌سازی یکپارچه‌سازی تلگرام/));
    expect(setConfig).toHaveBeenCalledTimes(1);
  });

  it('typing a bot token calls setConfig', () => {
    const setConfig = vi.fn();
    render(<TelegramSettings {...baseProps({ setConfig })} />);
    fireEvent.change(screen.getByPlaceholderText(/123456:ABC/), { target: { value: '999:XYZ' } });
    expect(setConfig).toHaveBeenCalled();
  });

  it('shows the guided 3-step setup when the error points to Firestore', () => {
    render(<TelegramSettings {...baseProps({ loadError: 'خواندن تنظیمات تلگرام از سرور ناموفق بود (آیا Firestore فعال است؟).' })} />);
    expect(screen.getByText(/Firestore.*هنوز آماده نیست/)).toBeInTheDocument();
    // a deep link into the Firebase console is offered
    const link = screen.getByText(/Firestore Database/i).closest('a');
    expect(link).toHaveAttribute('href', expect.stringContaining('console.firebase.google.com'));
  });

  it('shows a plain banner for a non-Firestore error', () => {
    render(<TelegramSettings {...baseProps({ loadError: 'یک خطای دیگر' })} />);
    expect(screen.getByText('یک خطای دیگر')).toBeInTheDocument();
    expect(screen.queryByText(/هنوز آماده نیست/)).toBeNull();
  });
});
