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

  // ST2 (silent flag policy enforced in the UI): a CRITICAL notification's silent toggle must be
  // disabled so the user can never set a value the transport would override.
  it('disables the silent toggle for the critical notification type', () => {
    render(<TelegramSettings {...baseProps()} />);
    expect(screen.getByText(/بحرانی \(همیشه باصدا\)/)).toBeInTheDocument();
    const criticalRow = screen.getByText(/خطاهای بحرانی برنامه/).closest('.tg-notif-row');
    const toggles = criticalRow.querySelectorAll('input[type="checkbox"]');
    // [0] = enabled toggle, [1] = silent toggle (disabled + forced unchecked).
    expect(toggles[1]).toBeDisabled();
    expect(toggles[1].checked).toBe(false);
  });

  it('leaves the silent toggle enabled for a non-critical notification type', () => {
    render(<TelegramSettings {...baseProps()} />);
    const routineRow = screen.getByText('خلاصهٔ روزانه').closest('.tg-notif-row');
    const toggles = routineRow.querySelectorAll('input[type="checkbox"]');
    expect(toggles[1]).not.toBeDisabled();
  });

  // ST3 (under-engineering fix): addReminder must actually add a reminder, and no-op on empty text.
  it('adds a reminder via setConfig when text is provided', () => {
    let cfg = makeConfig();
    const setConfig = vi.fn((fn) => { cfg = fn(cfg); });
    render(<TelegramSettings {...baseProps({ config: cfg, setConfig })} />);
    fireEvent.change(screen.getByPlaceholderText(/متن یادآوری/), { target: { value: 'مرور صفحه ۳' } });
    const addButtons = screen.getAllByText('افزودن');
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(setConfig).toHaveBeenCalled();
    expect(cfg.reminders.some((r) => r.text === 'مرور صفحه ۳')).toBe(true);
  });

  it('does not add a reminder when the text is empty (edge case no-op)', () => {
    const setConfig = vi.fn();
    render(<TelegramSettings {...baseProps({ setConfig })} />);
    const addButtons = screen.getAllByText('افزودن');
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(setConfig).not.toHaveBeenCalled();
  });
});
