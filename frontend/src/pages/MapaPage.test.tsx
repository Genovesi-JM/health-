import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../api';
import MapaPage from './MapaPage';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));
vi.mock('../components/Navbar', () => ({ Navbar: () => null }));
vi.mock('../components/Footer', () => ({ Footer: () => null }));

const facility = { id: 'facility', organisation_id: 'org', org_type: 'clinic',
  org_type_label: '<script>untrusted</script>', org_name: '<img src=x onerror=alert(1)>',
  name: 'Facility', address: '<b>Untrusted address</b>', contact_phone: '<i>123</i>',
  latitude: -8.8, longitude: 13.2, services: [] };
const marker = { addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), openPopup: vi.fn() };
const map = { setView: vi.fn().mockReturnThis(), fitBounds: vi.fn(), removeLayer: vi.fn(), remove: vi.fn() };
const leaflet = { map: vi.fn(() => map), marker: vi.fn(() => marker), divIcon: vi.fn(() => ({})), tileLayer: vi.fn(() => ({ addTo: vi.fn() })) };
const host = window as Window & { L?: typeof leaflet };

beforeEach(() => {
  vi.clearAllMocks();
  delete host.L;
  vi.mocked(api.get).mockResolvedValue({ data: [facility] });
});
afterEach(() => {
  delete host.L;
  document.querySelectorAll('script[src*="leaflet"], link[href*="leaflet"]').forEach(element => element.remove());
});

it('renders markers when the map library arrives after the facilities response and treats popup fields as text', async () => {
  render(<MapaPage />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(leaflet.marker).not.toHaveBeenCalled();
  const script = document.querySelector('script[src*="leaflet"]');
  expect(script).not.toBeNull();
  await act(async () => {
    host.L = leaflet;
    script!.dispatchEvent(new Event('load'));
  });
  await waitFor(() => expect(leaflet.marker).toHaveBeenCalledWith([-8.8, 13.2], expect.any(Object)));
  const popup = marker.bindPopup.mock.calls[0][0] as HTMLElement;
  expect(popup).toBeInstanceOf(HTMLElement);
  expect(popup.querySelector('img, script, b, i')).toBeNull();
  expect(popup.textContent).toContain(facility.org_name);
  expect(popup.textContent).toContain(facility.address);
  expect(popup.textContent).toContain(facility.org_type_label);
  expect(popup.textContent).toContain(facility.contact_phone);
});
