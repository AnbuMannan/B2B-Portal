import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Stats } from 'fs';

@Injectable()
export class FileSystemService {
  private readonly logger = new Logger(FileSystemService.name);

  constructor(private configService: ConfigService) {}

  async validateFileSystem(): Promise<void> {
    try {
      const uploadDir = this.configService.get<string>('upload.directory');
      
      if (!uploadDir) {
        throw new Error('Upload directory configuration is missing');
      }
      
      // Check if directory exists and is writable
      await this.ensureDirectoryExists(uploadDir);
      
      // Test write permissions
      const testFile = path.join(uploadDir, `.test-write-${Date.now()}.tmp`);
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      this.logger.log('✅ File system permissions validated successfully');
      
    } catch (error) {
      this.logger.error('❌ File system validation failed', error);
      throw new Error(`File system validation failed: ${(error as Error).message}`);
    }
  }

  async ensureDirectoryExists(directoryPath: string): Promise<void> {
    try {
      await fs.access(directoryPath);
    } catch {
      // Directory doesn't exist, create it
      this.logger.log(`Creating directory: ${directoryPath}`);
      await fs.mkdir(directoryPath, { recursive: true });
    }
  }

  async getFileStats(filePath: string): Promise<Stats> {
    return await fs.stat(filePath);
  }

  async isDirectoryWritable(directoryPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(directoryPath);
      const testFile = path.join(directoryPath, `.test-write-${Date.now()}.tmp`);
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }
}