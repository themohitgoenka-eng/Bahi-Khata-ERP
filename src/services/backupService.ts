import { dbStorage, CompanyDataset } from './storage/indexedDbStorage';

export interface BackupPackage {
  app: 'BahiKhata-ERP' | 'LekhaVeda_Accounting_ERP';
  version: '1.0.0';
  exportedAt: string;
  checksum: string;
  datasets: CompanyDataset[];
}

export interface SaveBackupOptions {
  overwriteConfirmed?: boolean;
}

export interface SaveBackupResult {
  success: boolean;
  requiresOverwriteConfirm?: boolean;
  filename: string;
  folderName: string;
  fyFolderName: string;
  companyName: string;
  companyInitials: string;
  fullRelativePath?: string;
}

/**
 * Extracts uppercase initials from company name for the backup filename.
 * e.g. "JAI SHREE SHYAM" -> "JSS" -> filename "BK-JSS.json"
 * e.g. "KANHA MARBLES" / "KANHA mARBLES" -> "KM" -> filename "BK-KM.json"
 */
export function getCompanyInitials(name: string): string {
  if (!name) return 'COMP';
  const cleaned = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'COMP';
  const initials = words.map((w) => w[0].toUpperCase()).join('');
  return initials || 'COMP';
}

/**
 * Formats financial year into standard 4-digit range format: "YYYY-YYYY"
 * e.g. "2026-2027", "2025-2026"
 */
export function getFiscalYearFolderName(
  fy?: { name?: string; startDate?: string; endDate?: string } | null
): string {
  if (fy?.startDate && fy?.endDate) {
    const sY = fy.startDate.split('-')[0];
    const eY = fy.endDate.split('-')[0];
    if (sY && eY && sY.length === 4 && eY.length === 4) {
      return `${sY}-${eY}`;
    }
  }
  if (fy?.name) {
    // Check 4-digit to 4-digit, e.g. "2026-2027"
    const matchFull = fy.name.match(/(\d{4})\s*[-/]\s*(\d{4})/);
    if (matchFull) {
      return `${matchFull[1]}-${matchFull[2]}`;
    }
    // Check 4-digit to 2-digit, e.g. "2026-27" or "FY 2026-27"
    const matchShort = fy.name.match(/(\d{4})\s*[-/]\s*(\d{2})/);
    if (matchShort) {
      const startYear = matchShort[1];
      const century = startYear.slice(0, 2);
      const endYear = `${century}${matchShort[2]}`;
      return `${startYear}-${endYear}`;
    }
    // Check 2-digit to 2-digit, e.g. "26-27"
    const matchTwoDigit = fy.name.match(/(\d{2})\s*[-/]\s*(\d{2})/);
    if (matchTwoDigit) {
      return `20${matchTwoDigit[1]}-20${matchTwoDigit[2]}`;
    }
  }
  const cur = new Date().getFullYear();
  return `${cur}-${cur + 1}`;
}

export class BackupService {
  // Simple checksum generator
  private static generateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  // 1. Generate System Backup JSON & computed file/folder names
  public static async generateBackupJson(): Promise<{
    finalJson: string;
    filename: string;
    companyName: string;
    companyInitials: string;
    fyName: string;
    fyFolderName: string;
  }> {
    const dataset = await dbStorage.exportCurrentDataset();
    if (!dataset) {
      throw new Error('No active dataset found to export.');
    }

    const payloadWithoutChecksum = {
      app: 'BahiKhata-ERP',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      datasets: [dataset],
    };

    const jsonStr = JSON.stringify(payloadWithoutChecksum);
    const checksum = this.generateChecksum(jsonStr);

    const fullPackage: BackupPackage = {
      ...(payloadWithoutChecksum as any),
      checksum,
    };

    const finalJson = JSON.stringify(fullPackage, null, 2);

    const companyName = dataset.company?.name || 'Company';
    const companyInitials = getCompanyInitials(companyName);
    const fyFolderName = getFiscalYearFolderName(dataset.fiscalYear);
    // Requested pattern: BK-<initial of company name>.json
    const filename = `BK-${companyInitials}.json`;

    return {
      finalJson,
      filename,
      companyName,
      companyInitials,
      fyName: dataset.fiscalYear?.name || fyFolderName,
      fyFolderName,
    };
  }

  // 2. Inspect target backup info without writing
  public static async getBackupTargetInfo(dirHandle?: any): Promise<{
    companyName: string;
    companyInitials: string;
    fyFolderName: string;
    filename: string;
    fileExists: boolean;
  }> {
    const dataset = await dbStorage.exportCurrentDataset();
    const companyName = dataset?.company?.name || 'Company';
    const companyInitials = getCompanyInitials(companyName);
    const fyFolderName = getFiscalYearFolderName(dataset?.fiscalYear);
    const filename = `BK-${companyInitials}.json`;

    let fileExists = false;
    if (dirHandle) {
      try {
        const fyDir = await dirHandle.getDirectoryHandle(fyFolderName, { create: false });
        await fyDir.getFileHandle(filename, { create: false });
        fileExists = true;
      } catch {
        fileExists = false;
      }
    }

    return {
      companyName,
      companyInitials,
      fyFolderName,
      filename,
      fileExists,
    };
  }

  // 3. Create Full System Backup and trigger Browser Download
  public static async createFullBackup(): Promise<string> {
    const { finalJson, filename, companyName, fyName, fyFolderName } = await this.generateBackupJson();

    // Download as file
    const blob = new Blob([finalJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await dbStorage.logAudit(
      'BACKUP',
      'BACKUP_SERVICE',
      '',
      `Full system backup created for ${companyName} (${fyFolderName}): ${filename}`
    );

    return finalJson;
  }

  // 4. Save Backup into Directory Handle inside the FY subfolder with Overwrite Confirmation support
  public static async saveBackupToDirectoryHandle(
    dirHandle: any,
    options?: SaveBackupOptions
  ): Promise<SaveBackupResult> {
    const { finalJson, filename, companyName, companyInitials, fyFolderName } =
      await this.generateBackupJson();

    if (dirHandle.queryPermission) {
      const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') {
          throw new Error('Write permission to the selected folder was denied.');
        }
      }
    }

    // Step A: Subfolder for this Financial Year (reuses existing folder if present, or creates it)
    const fyDirHandle = await dirHandle.getDirectoryHandle(fyFolderName, { create: true });

    // Step B: Check if BK-<INITIALS>.json already exists inside fyDirHandle
    let fileExists = false;
    try {
      await fyDirHandle.getFileHandle(filename, { create: false });
      fileExists = true;
    } catch {
      fileExists = false;
    }

    // If file exists and overwrite is NOT confirmed yet, prompt confirmation
    if (fileExists && !options?.overwriteConfirmed) {
      return {
        success: false,
        requiresOverwriteConfirm: true,
        filename,
        folderName: dirHandle.name || 'Selected Folder',
        fyFolderName,
        companyName,
        companyInitials,
        fullRelativePath: `${dirHandle.name || 'Selected Folder'}\\${fyFolderName}\\${filename}`,
      };
    }

    // Step C: Write the file
    const fileHandle = await fyDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(finalJson);
    await writable.close();

    const folderName = dirHandle.name || 'Selected Folder';

    await dbStorage.logAudit(
      'BACKUP',
      'BACKUP_SERVICE',
      '',
      `Backup saved to folder ${folderName}/${fyFolderName}/${filename}`
    );

    return {
      success: true,
      requiresOverwriteConfirm: false,
      filename,
      folderName,
      fyFolderName,
      companyName,
      companyInitials,
      fullRelativePath: `${folderName}\\${fyFolderName}\\${filename}`,
    };
  }

  // 5. Restore System from Backup JSON
  public static async restoreFromBackup(
    jsonContent: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const parsed: BackupPackage = JSON.parse(jsonContent);

      const validAppNames = ['BahiKhata-ERP', 'BahiKhata_ERP', 'LekhaVeda_Accounting_ERP', 'BahiKhata_Accounting_ERP'];
      if (
        !validAppNames.includes(parsed.app as string) ||
        !parsed.datasets ||
        parsed.datasets.length === 0
      ) {
        return {
          success: false,
          message: 'Invalid backup file format or missing accounting datasets.',
        };
      }

      for (const dataset of parsed.datasets) {
        await dbStorage.importDataset(dataset);
      }

      await dbStorage.logAudit(
        'RESTORE',
        'BACKUP_SERVICE',
        parsed.datasets[0].company.id,
        `Restored dataset from backup dated ${parsed.exportedAt}`
      );

      return {
        success: true,
        message: `Successfully restored ${parsed.datasets.length} company dataset(s). Reloading workspace...`,
      };
    } catch (err: any) {
      return { success: false, message: `Restore error: ${err.message}` };
    }
  }
}

export const backupService = {
  generateBackupJson: BackupService.generateBackupJson.bind(BackupService),
  getBackupTargetInfo: BackupService.getBackupTargetInfo.bind(BackupService),
  createFullBackup: BackupService.createFullBackup.bind(BackupService),
  exportBackup: BackupService.createFullBackup.bind(BackupService),
  saveBackupToDirectoryHandle: BackupService.saveBackupToDirectoryHandle.bind(BackupService),
  restoreFromBackup: BackupService.restoreFromBackup.bind(BackupService),
  restoreBackup: (fileContent: string) => BackupService.restoreFromBackup(fileContent),
};
