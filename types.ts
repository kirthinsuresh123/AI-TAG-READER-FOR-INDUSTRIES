
export interface MachinePart {
  id: string; 
  machineName: string;
  rawMaterials: string;
  technicalSpecs: string; // New: detailed units like PSI, inches, electrical, etc.
  units: string;
  internalComponents: string[]; // List of predicted internal parts
  lastUpdated: string;
  status: 'active' | 'updating';
  tagImageUrl?: string; // Original image of the tag
  imageUrl?: string;    // AI Generated digital twin URL
}

export interface ExtractionResult {
  machineName: string;
  rawMaterials: string;
  technicalSpecs: string; // Dimensions (Inches), Pressure (PSI), Temperature, etc.
  units: string;
  internalComponents: string[]; // Deduced internal components
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  SCANNING = 'SCANNING'
}
