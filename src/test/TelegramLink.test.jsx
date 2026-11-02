import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../lib/firebase.js', () => ({ auth: { currentUser: null } }));
const api = vi.hoisted(() => vi.fn());
vi.mock('../lib/inspectionApi.js', () => ({ api }));
import TelegramLink from '../components/TelegramLink.jsx';

describe('TelegramLink (secure chat linking)', () => {
  it('shows which typed chat ids are verified, and gives a one-time /start link', async () => {
    api.mockImplementation(async (path) => path === '/api/telegram/links'
      ? { links: [{ chatId: '111' }] }
      : { code: 'abcdefghijklmnop', deepLink: 'https://t.me/Bot?start=abcdefghijklmnop' });
    render(<TelegramLink user={{ uid: 'u' }} chatIds={['111', '222']} />);
    expect(await screen.findByText(/✓ تأییدشده/)).toBeInTheDocument();
    expect(screen.getByText(/✗ تأییدنشده/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('🔗 اتصالِ امنِ این حساب'));
    expect(await screen.findByText('/start abcdefghijklmnop')).toBeInTheDocument();
    expect(screen.getByText('باز کردن در تلگرام').getAttribute('href')).toBe('https://t.me/Bot?start=abcdefghijklmnop');
  });
  it('renders nothing for guests', () => {
    const { container } = render(<TelegramLink user={null} />);
    expect(container.innerHTML).toBe('');
  });
});
