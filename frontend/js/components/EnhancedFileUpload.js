/**
 * Enhanced File Upload Component
 * Provides drag-and-drop, validation, compression, and progress tracking
 */

class EnhancedFileUpload {
  constructor(options = {}) {
    this.options = {
      containerId: options.containerId || 'fileUploadContainer',
      type: options.type || 'photo', // photo, video, doc, avatar
      multiple: options.multiple !== false,
      autoCompress: options.autoCompress !== false,
      showPreview: options.showPreview !== false,
      onFilesSelected: options.onFilesSelected || null,
      onUploadComplete: options.onUploadComplete || null,
      onUploadError: options.onUploadError || null,
      ...options
    };

    this.selectedFiles = [];
    this.compressedFiles = [];
    this.isUploading = false;
    
    this.init();
  }

  init() {
    this.createUI();
    this.attachEvents();
  }

  createUI() {
    const container = document.getElementById(this.options.containerId);
    if (!container) {
      console.error(`Container ${this.options.containerId} not found`);
      return;
    }

    container.innerHTML = `
      <div class="enhanced-file-upload">
        <!-- Upload Zone -->
        <div class="file-upload-zone" id="uploadZone">
          <div class="file-upload-zone-icon">
            <i class="fas fa-cloud-upload-alt"></i>
          </div>
          <div class="file-upload-zone-text">
            Drag & Drop ${this.options.type}s here
          </div>
          <div class="file-upload-zone-hint">
            or click to browse
          </div>
          <input 
            type="file" 
            id="fileInput" 
            ${this.options.multiple ? 'multiple' : ''} 
            accept="${this.getAcceptTypes()}"
          />
        </div>

        <!-- Validation Errors -->
        <div id="validationErrors"></div>

        <!-- Compression Status -->
        <div id="compressionStatus"></div>

        <!-- File Preview Grid -->
        <div id="filePreviewGrid" class="file-preview-grid"></div>

        <!-- Upload Progress -->
        <div id="uploadProgressContainer" class="upload-progress-container"></div>

        <!-- Bulk Actions Bar -->
        <div id="bulkActionsBar" class="bulk-actions-bar">
          <span class="bulk-actions-count"></span>
          <button class="bulk-action-btn delete" id="bulkDeleteBtn">
            <i class="fas fa-trash"></i> Delete Selected
          </button>
          <button class="bulk-action-btn cancel" id="bulkCancelBtn">
            <i class="fas fa-times"></i> Cancel
          </button>
        </div>
      </div>
    `;
  }

  getAcceptTypes() {
    const types = fileManager.allowedTypes[this.options.type];
    return types ? types.join(',') : '*/*';
  }

  attachEvents() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    if (!uploadZone || !fileInput) return;

    // Click to upload
    uploadZone.addEventListener('click', () => fileInput.click());

    // File selection
    fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      this.handleFileSelection(e.dataTransfer.files);
    });

    // Bulk actions
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const bulkCancelBtn = document.getElementById('bulkCancelBtn');

    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteSelected());
    }

    if (bulkCancelBtn) {
      bulkCancelBtn.addEventListener('click', () => this.cancelSelection());
    }
  }

  async handleFileSelection(files) {
    if (!files || files.length === 0) return;

    // Validate files
    const validation = fileManager.validateFiles(files, this.options.type);
    
    // Show validation errors
    fileManager.showValidationErrors(validation, 'validationErrors');

    if (validation.valid.length === 0) {
      return;
    }

    // Store selected files
    this.selectedFiles = validation.valid;

    // Compress if enabled and applicable
    if (this.options.autoCompress && (this.options.type === 'photo' || this.options.type === 'avatar')) {
      await this.compressFiles();
    } else {
      this.compressedFiles = this.selectedFiles;
    }

    // Show preview
    if (this.options.showPreview) {
      await this.showPreviews();
    }

    // Callback
    if (this.options.onFilesSelected) {
      this.options.onFilesSelected({
        original: this.selectedFiles,
        compressed: this.compressedFiles,
        validation
      });
    }
  }

  async compressFiles() {
    const statusEl = document.getElementById('compressionStatus');
    statusEl.innerHTML = `
      <div class="compression-status">
        <div class="spinner"></div>
        <div class="compression-status-text">
          Compressing images... <span id="compressionProgress">0%</span>
        </div>
      </div>
    `;

    try {
      this.compressedFiles = await fileManager.compressImages(
        this.selectedFiles,
        this.options.type,
        (progress) => {
          const progressEl = document.getElementById('compressionProgress');
          if (progressEl) {
            progressEl.textContent = `${progress.percent}% (${progress.current}/${progress.total})`;
          }
        }
      );

      // Show compression stats
      const originalSize = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
      const compressedSize = this.compressedFiles.reduce((sum, f) => sum + f.size, 0);
      const savedPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      statusEl.innerHTML = `
        <div class="compression-stats">
          <div class="compression-stats-title">
            <i class="fas fa-check-circle"></i> Compression Complete
          </div>
          <div class="compression-stats-grid">
            <div class="compression-stat">
              <div class="compression-stat-value">${fileManager.formatFileSize(originalSize)}</div>
              <div class="compression-stat-label">Original</div>
            </div>
            <div class="compression-stat">
              <div class="compression-stat-value">${fileManager.formatFileSize(compressedSize)}</div>
              <div class="compression-stat-label">Compressed</div>
            </div>
            <div class="compression-stat">
              <div class="compression-stat-value">${savedPercent}%</div>
              <div class="compression-stat-label">Saved</div>
            </div>
          </div>
        </div>
      `;

      setTimeout(() => {
        statusEl.innerHTML = '';
      }, 5000);

    } catch (error) {
      console.error('Compression error:', error);
      statusEl.innerHTML = `
        <div class="alert alert-warning">
          <strong>Compression Warning:</strong> Some images could not be compressed. Using original files.
        </div>
      `;
      this.compressedFiles = this.selectedFiles;
    }
  }

  async showPreviews() {
    const grid = document.getElementById('filePreviewGrid');
    if (!grid) return;

    grid.innerHTML = '';

    for (let i = 0; i < this.compressedFiles.length; i++) {
      const file = this.compressedFiles[i];
      const preview = await fileManager.createPreview(file);
      
      const item = document.createElement('div');
      item.className = 'file-preview-item';
      item.dataset.index = i;

      let previewHTML = '';
      if (preview.type === 'image') {
        previewHTML = `<img src="${preview.url}" class="file-preview-image" alt="${file.name}">`;
      } else if (preview.type === 'video') {
        previewHTML = `<video src="${preview.url}" class="file-preview-video" muted></video>`;
      } else {
        previewHTML = `<div class="file-preview-icon"><i class="fas ${preview.icon}"></i></div>`;
      }

      item.innerHTML = `
        ${previewHTML}
        <div class="file-preview-actions">
          <button class="file-preview-action select" data-index="${i}">
            <i class="far fa-square"></i>
          </button>
          <button class="file-preview-action delete" data-index="${i}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        ${this.options.autoCompress && this.options.type === 'photo' ? 
          '<div class="file-preview-badge compressed">Compressed</div>' : ''}
        <div class="file-preview-info">
          <div class="file-preview-name" title="${file.name}">${file.name}</div>
          <div class="file-preview-size">${fileManager.formatFileSize(file.size)}</div>
        </div>
      `;

      // Attach events
      const selectBtn = item.querySelector('.select');
      const deleteBtn = item.querySelector('.delete');

      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSelection(i);
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(i);
      });

      grid.appendChild(item);
    }
  }

  toggleSelection(index) {
    const item = document.querySelector(`[data-index="${index}"]`);
    if (!item) return;

    item.classList.toggle('selected');
    
    const icon = item.querySelector('.select i');
    if (item.classList.contains('selected')) {
      icon.className = 'fas fa-check-square';
    } else {
      icon.className = 'far fa-square';
    }

    this.updateBulkActions();
  }

  updateBulkActions() {
    const selected = document.querySelectorAll('.file-preview-item.selected');
    const bar = document.getElementById('bulkActionsBar');
    const count = bar.querySelector('.bulk-actions-count');

    if (selected.length > 0) {
      bar.classList.add('show');
      count.textContent = `${selected.length} file${selected.length > 1 ? 's' : ''} selected`;
    } else {
      bar.classList.remove('show');
    }
  }

  async bulkDeleteSelected() {
    const selected = document.querySelectorAll('.file-preview-item.selected');
    if (selected.length === 0) return;

    if (!confirm(`Delete ${selected.length} file(s)?`)) return;

    // Remove from arrays
    const indicesToRemove = Array.from(selected).map(el => parseInt(el.dataset.index)).sort((a, b) => b - a);
    
    indicesToRemove.forEach(index => {
      this.selectedFiles.splice(index, 1);
      this.compressedFiles.splice(index, 1);
    });

    // Refresh preview
    await this.showPreviews();
    this.updateBulkActions();
  }

  cancelSelection() {
    document.querySelectorAll('.file-preview-item.selected').forEach(item => {
      item.classList.remove('selected');
      const icon = item.querySelector('.select i');
      icon.className = 'far fa-square';
    });
    this.updateBulkActions();
  }

  async removeFile(index) {
    if (!confirm('Delete this file?')) return;

    this.selectedFiles.splice(index, 1);
    this.compressedFiles.splice(index, 1);
    await this.showPreviews();
  }

  async uploadFiles(url) {
    if (this.isUploading) {
      alert('Upload already in progress');
      return;
    }

    if (this.compressedFiles.length === 0) {
      alert('No files to upload');
      return;
    }

    this.isUploading = true;

    try {
      const formData = new FormData();
      
      // Append files
      this.compressedFiles.forEach((file, index) => {
        formData.append(this.options.type === 'avatar' ? 'avatar' : `${this.options.type}`, file);
      });

      // Show progress
      const progressContainer = document.getElementById('uploadProgressContainer');
      const progressId = Date.now();
      
      progressContainer.innerHTML = fileManager.createProgressBar(progressId, `Uploading ${this.compressedFiles.length} file(s)...`);

      // Upload with progress
      const result = await fileManager.uploadWithProgress(
        url,
        formData,
        (progress) => {
          fileManager.updateProgressBar(progressId, progress);
        },
        (result) => {
          fileManager.removeProgressBar(progressId);
          
          if (result.success && this.options.onUploadComplete) {
            this.options.onUploadComplete(result.data);
          }
        }
      );

      // Clear files
      this.clear();

      return result;

    } catch (error) {
      console.error('Upload error:', error);
      
      if (this.options.onUploadError) {
        this.options.onUploadError(error);
      }
      
      throw error;
    } finally {
      this.isUploading = false;
    }
  }

  getFiles() {
    return {
      original: this.selectedFiles,
      compressed: this.compressedFiles
    };
  }

  clear() {
    this.selectedFiles = [];
    this.compressedFiles = [];
    
    const grid = document.getElementById('filePreviewGrid');
    const progressContainer = document.getElementById('uploadProgressContainer');
    const validationErrors = document.getElementById('validationErrors');
    const compressionStatus = document.getElementById('compressionStatus');
    
    if (grid) grid.innerHTML = '';
    if (progressContainer) progressContainer.innerHTML = '';
    if (validationErrors) validationErrors.innerHTML = '';
    if (compressionStatus) compressionStatus.innerHTML = '';
    
    this.updateBulkActions();
  }

  destroy() {
    const container = document.getElementById(this.options.containerId);
    if (container) {
      container.innerHTML = '';
    }
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedFileUpload;
}
