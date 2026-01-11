/**
 * File Management Utility
 * Handles file validation, compression, and upload with progress tracking
 */

class FileManager {
  constructor() {
    // File size limits (in bytes)
    this.limits = {
      photo: 10 * 1024 * 1024,      // 10MB
      video: 100 * 1024 * 1024,     // 100MB
      doc: 5 * 1024 * 1024,         // 5MB
      avatar: 5 * 1024 * 1024       // 5MB
    };

    // Allowed file types
    this.allowedTypes = {
      photo: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
      doc: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      avatar: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    };

    // Max file counts
    this.maxCounts = {
      photo: 10,
      video: 5,
      doc: 5,
      avatar: 1
    };

    // Compression settings
    this.compressionSettings = {
      photo: {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.85,
        mimeType: 'image/jpeg'
      },
      avatar: {
        maxWidth: 320,
        maxHeight: 320,
        quality: 0.80,
        mimeType: 'image/jpeg'
      }
    };

    this.uploadCallbacks = new Map();
  }

  /**
   * Validate file before upload
   */
  validateFile(file, type) {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push('No file provided');
      return { valid: false, errors };
    }

    // Check file size
    const maxSize = this.limits[type];
    if (!maxSize) {
      errors.push(`Unknown file type: ${type}`);
      return { valid: false, errors };
    }

    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      errors.push(`File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`);
    }

    // Check file type
    const allowedTypes = this.allowedTypes[type];
    if (!allowedTypes) {
      errors.push(`Unknown file type: ${type}`);
      return { valid: false, errors };
    }

    if (!allowedTypes.includes(file.type)) {
      errors.push(`Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check file name
    if (!file.name || file.name.length > 255) {
      errors.push('Invalid file name');
    }

    return {
      valid: errors.length === 0,
      errors,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2)
      }
    };
  }

  /**
   * Validate multiple files
   */
  validateFiles(files, type) {
    const results = {
      valid: [],
      invalid: [],
      totalSize: 0,
      errors: []
    };

    if (!files || files.length === 0) {
      results.errors.push('No files provided');
      return results;
    }

    // Check max count
    const maxCount = this.maxCounts[type];
    if (files.length > maxCount) {
      results.errors.push(`Too many files. Maximum ${maxCount} files allowed for ${type}`);
    }

    // Validate each file
    Array.from(files).forEach((file, index) => {
      const validation = this.validateFile(file, type);
      
      if (validation.valid) {
        results.valid.push(file);
        results.totalSize += file.size;
      } else {
        results.invalid.push({
          file,
          errors: validation.errors
        });
      }
    });

    // Add count to results
    results.validCount = results.valid.length;
    results.invalidCount = results.invalid.length;
    results.totalSizeMB = (results.totalSize / (1024 * 1024)).toFixed(2);

    return results;
  }

  /**
   * Compress image file
   */
  async compressImage(file, type = 'photo') {
    return new Promise((resolve, reject) => {
      // Skip compression for GIFs and non-image files
      if (file.type === 'image/gif' || !file.type.startsWith('image/')) {
        console.log('Skipping compression for', file.type);
        resolve(file);
        return;
      }

      const settings = this.compressionSettings[type] || this.compressionSettings.photo;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > settings.maxWidth || height > settings.maxHeight) {
            const ratio = Math.min(settings.maxWidth / width, settings.maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
                return;
              }

              // Create new file from blob
              const compressedFile = new File(
                [blob], 
                file.name.replace(/\.[^.]+$/, '.jpg'), 
                { type: settings.mimeType }
              );

              const originalSize = (file.size / 1024).toFixed(2);
              const compressedSize = (compressedFile.size / 1024).toFixed(2);
              const savedPercent = ((1 - compressedFile.size / file.size) * 100).toFixed(1);

              console.log(`✅ Compressed ${file.name}: ${originalSize}KB → ${compressedSize}KB (saved ${savedPercent}%)`);

              resolve(compressedFile);
            },
            settings.mimeType,
            settings.quality
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Compress multiple images
   */
  async compressImages(files, type = 'photo', onProgress = null) {
    const compressed = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        
        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            percent: Math.round(((i + 1) / total) * 100),
            fileName: file.name,
            status: 'compressing'
          });
        }

        const compressedFile = await this.compressImage(file, type);
        compressed.push(compressedFile);

      } catch (error) {
        console.error('Compression error:', error);
        // Use original file if compression fails
        compressed.push(files[i]);
      }
    }

    return compressed;
  }

  /**
   * Upload files with progress tracking
   */
  async uploadWithProgress(url, formData, onProgress = null, onComplete = null) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const uploadId = Date.now();

      // Track progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            onProgress({
              loaded: e.loaded,
              total: e.total,
              percent: percentComplete,
              loadedMB: (e.loaded / (1024 * 1024)).toFixed(2),
              totalMB: (e.total / (1024 * 1024)).toFixed(2),
              uploadId
            });
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (onComplete) {
              onComplete({ success: true, data: response });
            }
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Send request
      xhr.open('POST', url);
      
      // Add auth header
      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);

      // Store XHR for potential cancellation
      this.uploadCallbacks.set(uploadId, xhr);
    });
  }

  /**
   * Cancel upload by ID
   */
  cancelUpload(uploadId) {
    const xhr = this.uploadCallbacks.get(uploadId);
    if (xhr) {
      xhr.abort();
      this.uploadCallbacks.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get file icon based on type
   */
  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'fa-image';
    if (mimeType.startsWith('video/')) return 'fa-video';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word')) return 'fa-file-word';
    return 'fa-file';
  }

  /**
   * Create file preview
   */
  async createPreview(file) {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ type: 'image', url: e.target.result });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        resolve({ type: 'video', url });
      } else {
        resolve({ type: 'file', icon: this.getFileIcon(file.type) });
      }
    });
  }

  /**
   * Bulk delete files
   */
  async bulkDelete(visitId, files, onProgress = null) {
    const results = {
      success: [],
      failed: [],
      total: files.length
    };

    for (let i = 0; i < files.length; i++) {
      try {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: results.total,
            percent: Math.round(((i + 1) / results.total) * 100),
            fileName: files[i].path || files[i]
          });
        }

        const url = typeof files[i] === 'string' ? files[i] : files[i].path;
        
        // Call API to delete
        const response = await fetch(`${CONFIG.API_BASE_URL}/visits/${visitId}/media`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ url })
        });

        if (response.ok) {
          results.success.push(url);
        } else {
          const error = await response.json();
          results.failed.push({ url, error: error.message });
        }

      } catch (error) {
        results.failed.push({ 
          url: typeof files[i] === 'string' ? files[i] : files[i].path, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Show file validation errors
   */
  showValidationErrors(validation, containerId = 'validationErrors') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (validation.errors.length > 0 || validation.invalid.length > 0) {
      let html = '<div class="validation-errors alert alert-danger">';
      html += '<strong>File Validation Errors:</strong><ul>';

      // General errors
      validation.errors.forEach(error => {
        html += `<li>${error}</li>`;
      });

      // Invalid files
      validation.invalid.forEach(item => {
        html += `<li><strong>${item.file.name}:</strong><ul>`;
        item.errors.forEach(error => {
          html += `<li>${error}</li>`;
        });
        html += '</ul></li>';
      });

      html += '</ul></div>';
      container.innerHTML = html;
      container.style.display = 'block';
    } else {
      container.innerHTML = '';
      container.style.display = 'none';
    }
  }

  /**
   * Create progress bar HTML
   */
  createProgressBar(id, label = 'Uploading...') {
    return `
      <div id="progress-${id}" class="upload-progress">
        <div class="progress-label">${label}</div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="progress-info">
          <span class="progress-percent">0%</span>
          <span class="progress-size">0 MB / 0 MB</span>
        </div>
      </div>
    `;
  }

  /**
   * Update progress bar
   */
  updateProgressBar(id, progress) {
    const container = document.getElementById(`progress-${id}`);
    if (!container) return;

    const bar = container.querySelector('.progress-bar');
    const percent = container.querySelector('.progress-percent');
    const size = container.querySelector('.progress-size');

    if (bar) bar.style.width = `${progress.percent}%`;
    if (percent) percent.textContent = `${progress.percent}%`;
    if (size && progress.loadedMB && progress.totalMB) {
      size.textContent = `${progress.loadedMB} MB / ${progress.totalMB} MB`;
    }
  }

  /**
   * Remove progress bar
   */
  removeProgressBar(id) {
    const container = document.getElementById(`progress-${id}`);
    if (container) {
      container.remove();
    }
  }
}

// Create global instance
const fileManager = new FileManager();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = fileManager;
}
