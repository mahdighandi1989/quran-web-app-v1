import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AISettings from '../components/AISettings.jsx';
import { DEFAULT_AI } from '../lib/aiProviders.js';

const base = (over = {}) => ({ config: JSON.parse(JSON.stringify(DEFAULT_AI)), setConfig: () => {}, user: { displayName: 'T' }, persisted: true, ...over });

describe('AISettings panel', () => {
  it('lists the built-in providers in the selector', () => {
    const { container } = render(<AISettings {...base()} />);
    expect(screen.getByText(/کلیدها و مدل‌ها/)).toBeInTheDocument();
    const optionTexts = [...container.querySelectorAll('option')].map((o) => o.textContent);
    expect(optionTexts).toEqual(expect.arrayContaining(['OpenAI', 'Anthropic (Claude)', 'Groq', 'Google Gemini']));
  });

  it('shows the server-persistence note when signed in', () => {
    render(<AISettings {...base({ persisted: true })} />);
    expect(screen.getByText(/روی سرور و مخصوص حساب/)).toBeInTheDocument();
  });

  it('warns that keys are memory-only for a guest', () => {
    render(<AISettings {...base({ persisted: false, user: null })} />);
    expect(screen.getByText(/ذخیره نمی‌شود/)).toBeInTheDocument();
  });

  it('selecting a provider calls setConfig with provider + first model', () => {
    const setConfig = vi.fn();
    render(<AISettings {...base({ setConfig })} />);
    const select = screen.getByText('— انتخاب کنید —').closest('select');
    fireEvent.change(select, { target: { value: 'openai' } });
    expect(setConfig).toHaveBeenCalled();
  });

  it('shows the key input + model selector once a provider is active', () => {
    const cfg = { ...JSON.parse(JSON.stringify(DEFAULT_AI)), activeProvider: 'openai', activeModel: 'gpt-4o' };
    render(<AISettings {...base({ config: cfg })} />);
    expect(screen.getByPlaceholderText(/sk-/)).toBeInTheDocument();
    expect(screen.getByText('اعتبارسنجی کلید')).toBeInTheDocument();
    expect(screen.getByText(/افزودن پروایدر سفارشی/)).toBeInTheDocument();
  });
});
