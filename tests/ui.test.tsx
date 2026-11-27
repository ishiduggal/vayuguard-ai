import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { buildOfflineFallbackEnvironment, PRESET_INDIAN_CITIES } from '../src/shared/presets.js';

describe('VayuGuard React integration flows (mocked network)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const fallbackEnv = buildOfflineFallbackEnvironment(PRESET_INDIAN_CITIES[0]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/geocode')) {
          return new Response(JSON.stringify({ results: PRESET_INDIAN_CITIES }), { status: 200 });
        }
        if (url.includes('/api/environment')) {
          return new Response(JSON.stringify(fallbackEnv), { status: 200 });
        }
        if (url.includes('/api/seasonal')) {
          return new Response(
            JSON.stringify({
              cityName: 'Patiala',
              regionLabel: 'Punjab, India',
              currentObservationSummary: 'Modeled PM2.5 160 µg/m³',
              shortTermForecastSummary: '24h forecast summary',
              historicalPatternSummary: 'Historical winter pattern',
              cropBurningContextNote: 'Regional attribution note',
              calendar: [],
              sourceNote: 'Test seasonal',
            }),
            { status: 200 },
          );
        }
        if (url.includes('/api/assistant')) {
          return new Response(
            JSON.stringify({
              language: 'en',
              usedGemini: false,
              summary: 'Test grounded response',
              actionSteps: ['Step 1'],
              precautionNote: 'Non-clinical note',
              groundingNote: 'Open-Meteo',
            }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );
  });

  it('completes full 5-step onboarding, creates passport, and deletes all household data', async () => {
    render(<App />);

    expect(screen.getByText(/Build your Family Air Health Passport/i)).toBeInTheDocument();

    // Step 1 -> 2
    fireEvent.click(screen.getByRole('button', { name: /Ludhiana/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2: Household -> 3
    expect(screen.getByText(/Who lives in your household/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 3: Sensitivities -> 4
    expect(screen.getByText(/Sensitivities for/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 4: Daily routine -> 5
    expect(screen.getByText(/Daily routine for/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 5: Resources -> Create Passport
    expect(screen.getByText(/Home resources & habits/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Create Family Passport/i }));

    await waitFor(() => {
      expect(screen.getByText(/Ludhiana, Punjab/i)).toBeInTheDocument();
    });

    // Navigate to Family and delete all household data
    fireEvent.click(screen.getAllByRole('button', { name: /^Family$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Delete Household Data/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }));

    expect(screen.getByText(/Build your Family Air Health Passport/i)).toBeInTheDocument();
    expect(window.localStorage.getItem('vayuguard_household_v1')).toBeNull();
  });

  it('executes complete 60s Patiala Judge Demo: Today -> Family Compare -> Conflict Solver -> Plan Repair -> Home -> Assistant', async () => {
    render(<App />);

    // One-click Patiala Judge Demo
    fireEvent.click(screen.getByRole('button', { name: /Try 60s Patiala Family Demo/i }));

    await waitFor(() => {
      expect(screen.getByText(/Patiala, Punjab/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Rajesh/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Harbans Singh/i).length).toBeGreaterThan(0);

    // Switch to Family -> Side-by-Side Compare
    fireEvent.click(screen.getAllByRole('button', { name: /^Family$/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Compare/i }));
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Switch to Routine -> Conflict Solver & Plan Repair Simulation
    fireEvent.click(screen.getAllByRole('button', { name: /^Routine$/i })[0]);
    expect(screen.getByText(/Coordinated Household Schedule vs Original Plan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Simulate Forecast Change/i }));

    await waitFor(() => {
      expect(screen.getByText(/Exit Simulated Spike/i)).toBeInTheDocument();
    });

    // Switch to Home -> Indoor & Green Impact
    fireEvent.click(screen.getAllByRole('button', { name: /^Home$/i })[0]);
    expect(screen.getByText(/Indoor Air Intelligence/i)).toBeInTheDocument();
    expect(screen.getByText(/Green Impact Intelligence/i)).toBeInTheDocument();

    // Switch to Assistant & ask a question
    fireEvent.click(screen.getAllByRole('button', { name: /^Assistant$/i })[0]);
    fireEvent.click(
      screen.getByRole('button', {
        name: /We cannot afford an air purifier\. What can we do\?/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Test grounded response/i)).toBeInTheDocument();
    });
  });
});
