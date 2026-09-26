import { CityMasterItem, StateMasterItem } from '../../types';

// Standard 36 Indian States & Union Territories with GST 2-Digit Codes
export const INDIAN_STATES: StateMasterItem[] = [
  { code: '01', name: 'Jammu and Kashmir', shortCode: 'JK', capital: 'Srinagar / Jammu', isUnionTerritory: true },
  { code: '02', name: 'Himachal Pradesh', shortCode: 'HP', capital: 'Shimla', isUnionTerritory: false },
  { code: '03', name: 'Punjab', shortCode: 'PB', capital: 'Chandigarh', isUnionTerritory: false },
  { code: '04', name: 'Chandigarh', shortCode: 'CH', capital: 'Chandigarh', isUnionTerritory: true },
  { code: '05', name: 'Uttarakhand', shortCode: 'UK', capital: 'Dehradun', isUnionTerritory: false },
  { code: '06', name: 'Haryana', shortCode: 'HR', capital: 'Chandigarh', isUnionTerritory: false },
  { code: '07', name: 'Delhi', shortCode: 'DL', capital: 'New Delhi', isUnionTerritory: true },
  { code: '08', name: 'Rajasthan', shortCode: 'RJ', capital: 'Jaipur', isUnionTerritory: false },
  { code: '09', name: 'Uttar Pradesh', shortCode: 'UP', capital: 'Lucknow', isUnionTerritory: false },
  { code: '10', name: 'Bihar', shortCode: 'BR', capital: 'Patna', isUnionTerritory: false },
  { code: '11', name: 'Sikkim', shortCode: 'SK', capital: 'Gangtok', isUnionTerritory: false },
  { code: '12', name: 'Arunachal Pradesh', shortCode: 'AR', capital: 'Itanagar', isUnionTerritory: false },
  { code: '13', name: 'Nagaland', shortCode: 'NL', capital: 'Kohima', isUnionTerritory: false },
  { code: '14', name: 'Manipur', shortCode: 'MN', capital: 'Imphal', isUnionTerritory: false },
  { code: '15', name: 'Mizoram', shortCode: 'MZ', capital: 'Aizawl', isUnionTerritory: false },
  { code: '16', name: 'Tripura', shortCode: 'TR', capital: 'Agartala', isUnionTerritory: false },
  { code: '17', name: 'Meghalaya', shortCode: 'ML', capital: 'Shillong', isUnionTerritory: false },
  { code: '18', name: 'Assam', shortCode: 'AS', capital: 'Dispur', isUnionTerritory: false },
  { code: '19', name: 'West Bengal', shortCode: 'WB', capital: 'Kolkata', isUnionTerritory: false },
  { code: '20', name: 'Jharkhand', shortCode: 'JH', capital: 'Ranchi', isUnionTerritory: false },
  { code: '21', name: 'Odisha', shortCode: 'OD', capital: 'Bhubaneswar', isUnionTerritory: false },
  { code: '22', name: 'Chhattisgarh', shortCode: 'CG', capital: 'Raipur', isUnionTerritory: false },
  { code: '23', name: 'Madhya Pradesh', shortCode: 'MP', capital: 'Bhopal', isUnionTerritory: false },
  { code: '24', name: 'Gujarat', shortCode: 'GJ', capital: 'Gandhinagar', isUnionTerritory: false },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', shortCode: 'DN', capital: 'Daman', isUnionTerritory: true },
  { code: '27', name: 'Maharashtra', shortCode: 'MH', capital: 'Mumbai', isUnionTerritory: false },
  { code: '28', name: 'Andhra Pradesh', shortCode: 'AP', capital: 'Amaravati', isUnionTerritory: false },
  { code: '29', name: 'Karnataka', shortCode: 'KA', capital: 'Bengaluru', isUnionTerritory: false },
  { code: '30', name: 'Goa', shortCode: 'GA', capital: 'Panaji', isUnionTerritory: false },
  { code: '31', name: 'Lakshadweep', shortCode: 'LD', capital: 'Kavaratti', isUnionTerritory: true },
  { code: '32', name: 'Kerala', shortCode: 'KL', capital: 'Thiruvananthapuram', isUnionTerritory: false },
  { code: '33', name: 'Tamil Nadu', shortCode: 'TN', capital: 'Chennai', isUnionTerritory: false },
  { code: '34', name: 'Puducherry', shortCode: 'PY', capital: 'Puducherry', isUnionTerritory: true },
  { code: '35', name: 'Andaman and Nicobar Islands', shortCode: 'AN', capital: 'Port Blair', isUnionTerritory: true },
  { code: '36', name: 'Telangana', shortCode: 'TS', capital: 'Hyderabad', isUnionTerritory: false },
  { code: '37', name: 'Andhra Pradesh (New)', shortCode: 'AD', capital: 'Amaravati', isUnionTerritory: false },
  { code: '38', name: 'Ladakh', shortCode: 'LA', capital: 'Leh', isUnionTerritory: true },
];

export const DEFAULT_CITIES: CityMasterItem[] = [
  {
    id: 'city-rm-mandi',
    cityName: 'Ramganj Mandi',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Kota',
    pincode: '326519',
    isActive: true,
    notes: 'Primary hub for Kota Stone Mining, Polishing & Rail Transit',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-kota',
    cityName: 'Kota',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Kota',
    pincode: '324005',
    isActive: true,
    notes: 'Divisional Headquarter & Major Industrial Hub',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-jhalawar',
    cityName: 'Jhalawar',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Jhalawar',
    pincode: '326001',
    isActive: true,
    notes: 'Adjacent Stone Mining & Quarry Cluster',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-suket',
    cityName: 'Suket',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Kota',
    pincode: '326530',
    isActive: true,
    notes: 'Key Quarry and Extraction Belt near Ramganj Mandi',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-chechat',
    cityName: 'Chechat',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Kota',
    pincode: '326518',
    isActive: true,
    notes: 'Limestone Mines & Processing Yards',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-morak',
    cityName: 'Morak',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Kota',
    pincode: '326517',
    isActive: true,
    notes: 'Cement Manufacturing & Stone Processing belt',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-kishangarh',
    cityName: 'Kishangarh',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Ajmer',
    pincode: '305801',
    isActive: true,
    notes: 'Asia Marble & Granite Trading Hub',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-jaipur',
    cityName: 'Jaipur',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Jaipur',
    pincode: '302001',
    isActive: true,
    notes: 'State Capital & Commercial Center',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-udaipur',
    cityName: 'Udaipur',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Udaipur',
    pincode: '313001',
    isActive: true,
    notes: 'Green Marble & Soapstone Processing Hub',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-bhilwara',
    cityName: 'Bhilwara',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Bhilwara',
    pincode: '311001',
    isActive: true,
    notes: 'Sandstone & Granite mining district',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-jodhpur',
    cityName: 'Jodhpur',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Jodhpur',
    pincode: '342001',
    isActive: true,
    notes: 'Red Sandstone & Cobbles Export Center',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-chittorgarh',
    cityName: 'Chittorgarh',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Chittorgarh',
    pincode: '312001',
    isActive: true,
    notes: 'Cement, Limestone & Granite Cluster',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-makrana',
    cityName: 'Makrana',
    stateName: 'Rajasthan',
    stateCode: '08',
    district: 'Nagaur',
    pincode: '341505',
    isActive: true,
    notes: 'Historic White Marble Mines',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-indore',
    cityName: 'Indore',
    stateName: 'Madhya Pradesh',
    stateCode: '23',
    district: 'Indore',
    pincode: '452001',
    isActive: true,
    notes: 'Commercial Capital of MP & Major Consuming Market',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-bhopal',
    cityName: 'Bhopal',
    stateName: 'Madhya Pradesh',
    stateCode: '23',
    district: 'Bhopal',
    pincode: '462001',
    isActive: true,
    notes: 'MP State Capital & Infrastructure Project Consumer',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-ujjain',
    cityName: 'Ujjain',
    stateName: 'Madhya Pradesh',
    stateCode: '23',
    district: 'Ujjain',
    pincode: '456001',
    isActive: true,
    notes: 'High Demand Religious & Civil Construction Market',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-neemuch',
    cityName: 'Neemuch',
    stateName: 'Madhya Pradesh',
    stateCode: '23',
    district: 'Neemuch',
    pincode: '458441',
    isActive: true,
    notes: 'Border Commercial Town with Kota & Chittor',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-ahmedabad',
    cityName: 'Ahmedabad',
    stateName: 'Gujarat',
    stateCode: '24',
    district: 'Ahmedabad',
    pincode: '380001',
    isActive: true,
    notes: 'Major Gujarat Distribution & Builder Market',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-surat',
    cityName: 'Surat',
    stateName: 'Gujarat',
    stateCode: '24',
    district: 'Surat',
    pincode: '395001',
    isActive: true,
    notes: 'Heavy Stone & Tile Consumer Market',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-delhi',
    cityName: 'New Delhi',
    stateName: 'Delhi',
    stateCode: '07',
    district: 'Central Delhi',
    pincode: '110001',
    isActive: true,
    notes: 'NCR Mega Projects & Institutional Demand',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'city-mumbai',
    cityName: 'Mumbai',
    stateName: 'Maharashtra',
    stateCode: '27',
    district: 'Mumbai',
    pincode: '400001',
    isActive: true,
    notes: 'Premier Financial & Commercial Export Market',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const STORAGE_KEY = 'bahi_khata_city_state_master_v1';

class CityStateService {
  private listeners: Set<() => void> = new Set();

  public getStates(): StateMasterItem[] {
    return INDIAN_STATES;
  }

  public getStateByCode(code: string): StateMasterItem | undefined {
    const formatted = code.padStart(2, '0');
    return INDIAN_STATES.find((s) => s.code === formatted);
  }

  public getStateByName(name: string): StateMasterItem | undefined {
    if (!name) return undefined;
    const lower = name.trim().toLowerCase();
    return INDIAN_STATES.find((s) => s.name.toLowerCase() === lower);
  }

  public getCities(companyId?: string): CityMasterItem[] {
    try {
      const key = companyId ? `${STORAGE_KEY}_${companyId}` : STORAGE_KEY;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load cities from localStorage', e);
    }

    // Default fallback
    this.saveAllCities(DEFAULT_CITIES, companyId);
    return DEFAULT_CITIES;
  }

  public saveAllCities(cities: CityMasterItem[], companyId?: string): void {
    try {
      const key = companyId ? `${STORAGE_KEY}_${companyId}` : STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(cities));
      this.notify();
    } catch (e) {
      console.error('Failed to save cities', e);
    }
  }

  public saveCity(city: CityMasterItem, companyId?: string): CityMasterItem {
    const current = this.getCities(companyId);
    const now = new Date().toISOString();

    // Auto-resolve state code if missing
    let stateCode = city.stateCode;
    if (!stateCode && city.stateName) {
      const st = this.getStateByName(city.stateName);
      if (st) stateCode = st.code;
    }

    const prepared: CityMasterItem = {
      ...city,
      stateCode: stateCode || '08',
      updatedAt: now,
    };

    let updated: CityMasterItem[];
    const existingIndex = current.findIndex((c) => c.id === city.id);

    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = prepared;
    } else {
      updated = [prepared, ...current];
    }

    this.saveAllCities(updated, companyId);
    return prepared;
  }

  public deleteCity(id: string, companyId?: string): boolean {
    const current = this.getCities(companyId);
    const target = current.find((c) => c.id === id);
    if (!target) return false;

    const remaining = current.filter((c) => c.id !== id);
    this.saveAllCities(remaining, companyId);
    return true;
  }

  public setDefaultCity(_id: string, _companyId?: string): void {
    // No-op kept for backwards compatibility
  }

  public findCity(name: string, companyId?: string): CityMasterItem | undefined {
    if (!name) return undefined;
    const clean = name.trim().toLowerCase();
    const cities = this.getCities(companyId);
    return cities.find((c) => c.cityName.toLowerCase() === clean);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error in cityStateService listener:', e);
      }
    });
  }
}

export const cityStateService = new CityStateService();
