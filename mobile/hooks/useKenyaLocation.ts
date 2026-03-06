import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { fuzzyMatchCounty, fuzzyMatchSubcounty } from '@/lib/kenyaAdminData';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export type KenyaLocationStatus = 'idle' | 'locating' | 'geocoding' | 'done' | 'error';

export interface UseKenyaLocationResult {
  status: KenyaLocationStatus;
  coords: { latitude: number; longitude: number } | null;
  detectedRegion: string;
  detectedCounty: string;
  detectedSubcounty: string;
  errorMessage: string;
  isOutsideKenya: boolean;
  refresh: () => Promise<void>;
}

export function useKenyaLocation(autoRun = true): UseKenyaLocationResult {
  const [status, setStatus] = useState<KenyaLocationStatus>('idle');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectedRegion, setDetectedRegion] = useState('');
  const [detectedCounty, setDetectedCounty] = useState('');
  const [detectedSubcounty, setDetectedSubcounty] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isOutsideKenya, setIsOutsideKenya] = useState(false);

  const detectLocation = useCallback(async () => {
    setStatus('locating');
    setErrorMessage('');
    setIsOutsideKenya(false);
    setDetectedRegion('');
    setDetectedCounty('');
    setDetectedSubcounty('');

    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        setErrorMessage('Location permission denied. Enable it in settings to auto-detect region and county.');
        setStatus('error');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setCoords({ latitude, longitude });
      setStatus('geocoding');

      const response = await fetch(
        `${NOMINATIM_URL}?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'MazaoFieldOfficer/1.0',
          },
        }
      );
      const geo = await response.json();
      const addr = geo?.address || {};

      if (addr.country_code !== 'ke') {
        setIsOutsideKenya(true);
        setStatus('done');
        return;
      }

      const rawCounty =
        addr.county ||
        addr.state_district ||
        addr.state ||
        addr.city ||
        addr.town ||
        '';
      const match = fuzzyMatchCounty(rawCounty) || fuzzyMatchCounty(addr.state);

      if (match) {
        setDetectedRegion(match.region);
        setDetectedCounty(match.county);
        const subcountyCandidates = [
          addr.district,
          addr.suburb,
          addr.quarter,
          addr.neighbourhood,
          addr.village,
          addr.municipality,
          addr.state_district,
        ].filter(Boolean) as string[];
        for (const raw of subcountyCandidates) {
          const matchedSub = fuzzyMatchSubcounty(raw, match.subcounties);
          if (matchedSub) {
            setDetectedSubcounty(matchedSub);
            break;
          }
        }
      }

      setStatus('done');
    } catch {
      setErrorMessage('Could not detect location. Check internet and try again.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (autoRun) detectLocation();
  }, [autoRun, detectLocation]);

  return {
    status,
    coords,
    detectedRegion,
    detectedCounty,
    detectedSubcounty,
    errorMessage,
    isOutsideKenya,
    refresh: detectLocation,
  };
}
