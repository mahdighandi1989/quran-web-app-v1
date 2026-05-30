import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TelegramSettings from '../components/TelegramSettings.jsx';
import { DEFAULT_TELEGRAM } from '../lib/telegram.js';

const makeSettings = () => ({ telegram: JSON.parse(JSON.stringify(DEFAULT_TELEGRAM)) });

describe('TelegramSettings panel', () => {
  it('renders the section heading, notification rows and reminders section', () => {
    render(<TelegramSettings settings={makeSettings()} setSettings={() => {}} />);
    expect(screen.getByText(/تعامل تلگرام/)).toBeInTheDocument();
    expect(screen.getByText(/کدام اعلان‌ها ارسال شوند/)).toBeInTheDocument();
    // reminders section (unique add button) + one notification-type row label
    expect(screen.getByText(/افزودن یادآوری/)).toBeInTheDocument();
    expect(screen.getByText('نتیجهٔ آزمون')).toBeInTheDocument();
  });

  it('shows the bot-token security warning', () => {
    render(<TelegramSettings settings={makeSettings()} setSettings={() => {}} />);
    expect(screen.getByText(/توکن بات یک «سِکرت» است/)).toBeInTheDocument();
  });

  it('toggling master enable calls setSettings', () => {
    const setSettings = vi.fn();
    render(<TelegramSettings settings={makeSettings()} setSettings={setSettings} />);
    fireEvent.click(screen.getByLabelText(/فعال‌سازی یکپارچه‌سازی تلگرام/));
    expect(setSettings).toHaveBeenCalledTimes(1);
  });

  it('typing a bot token calls setSettings', () => {
    const setSettings = vi.fn();
    render(<TelegramSettings settings={makeSettings()} setSettings={setSettings} />);
    fireEvent.change(screen.getByPlaceholderText(/123456:ABC/), { target: { value: '999:XYZ' } });
    expect(setSettings).toHaveBeenCalled();
  });
});
