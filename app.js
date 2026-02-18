// 专业PDF页码添加工具
class PDFPageNumberAdder {
    constructor() {
        this.pdfBytes = null;
        this.pdfDoc = null;
        this.currentPageIndex = 0;
        this.previewPdfDoc = null;
        this.isPreviewGenerated = false;
        this.previewDebounceTimer = null;
        this.pdfjsDocument = null;
        this.renderTask = null;
        
        // 配置PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
        
        this.initializeElements();
        this.bindEvents();
        this.setupFontSizeSlider();
        this.initializeCanvas();
    }
    
    initializeElements() {
        this.dropArea = document.getElementById('dropArea');
        this.fileInput = document.getElementById('fileInput');
        this.mobileFileBtn = document.getElementById('mobileFileBtn');
        this.controls = document.getElementById('controls');
        this.pdfInfo = document.getElementById('pdfInfo');
        this.addPageNumsBtn = document.getElementById('addPageNumsBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.progress = document.getElementById('progress');
        this.progressFill = document.getElementById('progressFill');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        // 设置元素
        this.positionSelect = document.getElementById('positionSelect');
        this.customPositionGroup = document.getElementById('customPositionGroup');
        this.customX = document.getElementById('customX');
        this.customY = document.getElementById('customY');
        this.customXValue = document.getElementById('customXValue');
        this.customYValue = document.getElementById('customYValue');
        this.pageNumStart = document.getElementById('pageNumStart');
        this.pageNumFormat = document.getElementById('pageNumFormat');
        this.fontSize = document.getElementById('fontSize');
        this.fontColor = document.getElementById('fontColor');
        this.firstPageCheckbox = document.getElementById('firstPageCheckbox');
        
        // 预览相关元素
        this.previewBtn = document.getElementById('previewBtn');
        this.prevPage = document.getElementById('prevPage');
        this.nextPage = document.getElementById('nextPage');
        this.pageNumDisplay = document.getElementById('pageNumDisplay');
        this.pdfPreviewCanvas = document.getElementById('pdfPreviewCanvas');
        this.pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
        
        // 初始化按钮状态
        this.updatePageNavButtons();
        
        // 移动端Chrome兼容性处理
        this.setupMobileCompatibility();
    }
    
    setupMobileCompatibility() {
        // 检测Chrome移动端
        const isChromeMobile = /Chrome/i.test(navigator.userAgent) && /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isChromeMobile && this.mobileFileBtn) {
            // 为Chrome移动端添加额外的样式
            this.mobileFileBtn.style.touchAction = 'manipulation';
            this.mobileFileBtn.style.webkitTapHighlightColor = 'transparent';
        }
    }
    
    initializeCanvas() {
        const canvas = this.pdfPreviewCanvas;
        canvas.width = 600;
        canvas.height = 800;
        
        const context = canvas.getContext('2d');
        context.fillStyle = '#f8fafc';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#4a5568';
        context.font = '18px Arial';
        context.textAlign = 'center';
        context.fillText('上传PDF文件后', canvas.width/2, canvas.height/2 - 30);
        context.fillText('点击"生成预览"查看效果', canvas.width/2, canvas.height/2 + 10);
    }
    
    bindEvents() {
        // 桌面端拖拽区域点击事件
        this.dropArea.addEventListener('click', (e) => {
            // 防止在移动端按钮上点击时触发
            if (e.target !== this.mobileFileBtn && e.target !== this.fileInput) {
                console.log('Drop area clicked, triggering file input');
                this.triggerFileInput();
            }
        });
        
        // 移动端文件选择按钮点击事件
        if (this.mobileFileBtn) {
            this.mobileFileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Mobile file button clicked, triggering file input');
                this.triggerFileInput();
            });
        }

        this.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropArea.classList.add('dragover');
        });

        this.dropArea.addEventListener('dragleave', () => {
            this.dropArea.classList.remove('dragover');
        });

        this.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // 确保只处理PDF文件
                const pdfFile = Array.from(files).find(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
                if (pdfFile) {
                    this.handleFile(pdfFile);
                } else {
                    this.showError('请选择PDF文件');
                }
            }
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                // 确保是PDF文件
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    this.handleFile(file);
                } else {
                    this.showError('请选择PDF文件');
                }
            }
        });
        
        // 监听页码设置变化，以便实时更新预览
        this.positionSelect.addEventListener('change', (e) => {
            this.toggleCustomPosition(e.target.value === 'custom');
            this.maybeUpdatePreview();
        });
        
        this.addPageNumsBtn.addEventListener('click', async () => {
            await this.addPageNumbers();
        });
        
        this.previewBtn.addEventListener('click', async () => {
            await this.generatePreview();
        });
        
        this.prevPage.addEventListener('click', () => {
            if (this.currentPageIndex > 0) {
                this.currentPageIndex--;
                this.renderCurrentPage();
                this.updatePageNavButtons();
            }
        });
        
        this.nextPage.addEventListener('click', () => {
            if (this.pdfDoc && this.currentPageIndex < this.pdfDoc.getPageCount() - 1) {
                this.currentPageIndex++;
                this.renderCurrentPage();
                this.updatePageNavButtons();
            }
        });
        
        // 监听页码设置变化，以便实时更新预览
        this.positionSelect.addEventListener('change', (e) => {
            this.toggleCustomPosition(e.target.value === 'custom');
            this.maybeUpdatePreview();
        });
        
        this.customX.addEventListener('input', () => {
            this.customXValue.textContent = this.customX.value + '%';
            this.maybeUpdatePreview();
        });
        
        this.customY.addEventListener('input', () => {
            this.customYValue.textContent = this.customY.value + '%';
            this.maybeUpdatePreview();
        });
        
        this.pageNumStart.addEventListener('input', this.maybeUpdatePreview.bind(this));
        this.pageNumFormat.addEventListener('change', this.maybeUpdatePreview.bind(this));
        this.fontSize.addEventListener('input', this.maybeUpdatePreview.bind(this));
        this.fontColor.addEventListener('input', this.maybeUpdatePreview.bind(this));
        this.firstPageCheckbox.addEventListener('change', this.maybeUpdatePreview.bind(this));
    }
    
    toggleCustomPosition(show) {
        this.customPositionGroup.style.display = show ? 'flex' : 'none';
    }
    
    setupFontSizeSlider() {
        const fontSizeValue = document.getElementById('fontSizeValue');
        this.fontSize.addEventListener('input', () => {
            fontSizeValue.textContent = this.fontSize.value;
        });
    }
    
    async handleFile(file) {
        // 保存当前文件引用
        this.currentFile = file;
        
        try {
            // 显示文件读取进度
            this.showProgress(true, '正在读取文件...');
            this.pdfBytes = await this.readFileAsync(file, (progress) => {
                this.updateProgress(progress, '正在读取文件...');
            });
            
            // 显示PDF处理进度
            this.updateProgress(0, '正在处理PDF...');
            await this.loadPdfInfo();
            
            // 重置预览状态
            this.currentPageIndex = 0;
            this.isPreviewGenerated = false;
            this.pdfjsDocument = null;
            
            // 显示控制面板
            this.controls.style.display = 'flex';
            this.updatePageNavButtons();
            
        } catch (error) {
            console.error('处理文件时出错:', error);
            this.showError('处理文件时发生错误，请查看控制台了解详情。');
        } finally {
            this.showProgress(false);
        }
    }
    
    readFileAsync(file, onProgress = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            if (onProgress) {
                reader.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100;
                        onProgress(progress);
                    }
                };
            }
            reader.readAsArrayBuffer(file);
        });
    }
    
    async loadPdfInfo() {
        try {
            this.pdfDoc = await PDFLib.PDFDocument.load(this.pdfBytes);
            const pageCount = this.pdfDoc.getPageCount();
            
            // 获取文件名（处理拖放和点击两种情况）
            const fileName = this.currentFile ? this.currentFile.name : '未知文件';
            
            this.pdfInfo.innerHTML = `
                <p><strong>文件名称:</strong> ${fileName}</p>
                <p><strong>总页数:</strong> ${pageCount} 页</p>
                <p><strong>文件大小:</strong> ${(this.pdfBytes.byteLength / 1024).toFixed(1)} KB</p>
                <p><strong>起始页码:</strong> 从第 ${this.pageNumStart.value} 页开始</p>
            `;
            
            this.updatePageNavButtons();
        } catch (error) {
            console.error('加载PDF信息时出错:', error);
            this.showError('加载PDF信息时发生错误，请查看控制台了解详情。');
        }
    }
    
    calculatePageNumberPosition(position, customX, customY, width, height) {
        let x, y;
        
        switch(position) {
            case 'bottom-right':
                x = width - 60;
                y = 40;
                break;
            case 'bottom-left':
                x = 60;
                y = 40;
                break;
            case 'bottom-center':
                x = width / 2;
                y = 40;
                break;
            case 'top-right':
                x = width - 60;
                y = height - 40;
                break;
            case 'top-left':
                x = 60;
                y = height - 40;
                break;
            case 'top-center':
                x = width / 2;
                y = height - 40;
                break;
            case 'custom':
                // 使用百分比位置
                x = (width * customX) / 100;
                y = (height * customY) / 100;
                break;
            default:
                x = width - 60;
                y = 40;
        }
        
        return { x, y };
    }
    
    // 检查字符串是否包含中文字符
    containsChinese(str) {
        const chineseRegex = /[\u4e00-\u9fff]/;
        return chineseRegex.test(str);
    }
    
    // 为中文格式提供回退方案
    getFallbackForChinese(chineseStr) {
        // 如果是"第X页"格式，转换为"Page X"
        if (chineseStr.startsWith('第') && chineseStr.endsWith('页')) {
            const pageNum = chineseStr.substring(1, chineseStr.length - 1);
            return `Page ${pageNum}`;
        }
        // 其他情况，返回原数字
        return chineseStr.replace(/[^0-9]/g, '');
    }
    
    // 检查是否需要Unicode字体
    needsUnicodeFont(format) {
        return format === '第1页';
    }
    
    async generatePreview() {
        if (!this.pdfDoc) {
            this.showError('请先上传PDF文件');
            return;
        }
        
        try {
            this.showLoadingIndicator(true);
            
            // 创建预览PDF副本
            this.previewPdfDoc = await PDFLib.PDFDocument.load(this.pdfBytes);
            const pageCount = this.previewPdfDoc.getPageCount();
            const startPos = parseInt(this.pageNumStart.value);
            const format = this.pageNumFormat.value;
            const fontSize = parseInt(this.fontSize.value);
            const fontColor = this.fontColor.value;
            const position = this.positionSelect.value;
            const customX = parseInt(this.customX.value);
            const customY = parseInt(this.customY.value);
            const includeFirstPage = this.firstPageCheckbox.checked;
            
            // 添加页码到预览文档
            for (let i = 0; i < pageCount; i++) {
                if (!includeFirstPage && i === 0) {
                    continue;
                }
                
                const pageNum = this.formatPageNumber(
                    includeFirstPage ? startPos + i : startPos + i - 1,
                    format,
                    pageCount
                );
                const page = this.previewPdfDoc.getPage(i);
                const { width, height } = page.getSize();
                
                // 计算页码位置
                const { x, y } = this.calculatePageNumberPosition(position, customX, customY, width, height);
                
                // 添加页码文本
                page.drawText(pageNum, {
                    x: x,
                    y: y,
                    size: fontSize,
                    color: PDFLib.rgb(
                        parseInt(fontColor.substr(1, 2), 16) / 255,
                        parseInt(fontColor.substr(3, 2), 16) / 255,
                        parseInt(fontColor.substr(5, 2), 16) / 255
                    ),
                    opacity: 0.9
                });
            }
            
            // 保存预览PDF并加载到PDF.js
            const previewPdfBytes = await this.previewPdfDoc.save();
            this.pdfjsDocument = await pdfjsLib.getDocument({
                data: previewPdfBytes
            }).promise;
            
            this.isPreviewGenerated = true;
            await this.renderCurrentPage();
            
            console.log('预览生成成功！');
            
        } catch (error) {
            console.error('生成预览时出错:', error);
            this.showError('生成预览时发生错误，请查看控制台了解详情。');
        } finally {
            this.showLoadingIndicator(false);
        }
    }
    
    async renderCurrentPage() {
        if (!this.pdfjsDocument) {
            this.initializeCanvas();
            return;
        }
        
        try {
            this.showLoadingIndicator(true);
            
            const page = await this.pdfjsDocument.getPage(this.currentPageIndex + 1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = this.pdfPreviewCanvas;
            const context = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            // 取消之前的渲染任务（如果存在）
            if (this.renderTask) {
                this.renderTask.cancel();
            }
            
            this.renderTask = page.render(renderContext);
            await this.renderTask.promise;
            
        } catch (error) {
            if (error.name !== 'RenderingCancelledException') {
                console.error('渲染页面时出错:', error);
                this.showError('渲染页面时发生错误，请查看控制台了解详情。');
            }
        } finally {
            this.showLoadingIndicator(false);
        }
    }
    
    updatePageNavButtons() {
        if (this.pdfDoc) {
            const pageCount = this.pdfDoc.getPageCount();
            this.pageNumDisplay.textContent = `${this.currentPageIndex + 1} / ${pageCount}`;
            
            this.prevPage.disabled = this.currentPageIndex === 0;
            this.nextPage.disabled = this.currentPageIndex === pageCount - 1;
        } else {
            this.pageNumDisplay.textContent = '0 / 0';
            this.prevPage.disabled = true;
            this.nextPage.disabled = true;
        }
    }
    
    async addPageNumbers() {
        if (!this.pdfBytes) {
            this.showError('请先上传PDF文件');
            return;
        }
        
        try {
            this.showProgress(true);
            
            const pdfDoc = await PDFLib.PDFDocument.load(this.pdfBytes);
            const pageCount = pdfDoc.getPageCount();
            const startPos = parseInt(this.pageNumStart.value);
            const format = this.pageNumFormat.value;
            const fontSize = parseInt(this.fontSize.value);
            const fontColor = this.fontColor.value;
            const position = this.positionSelect.value;
            const customX = parseInt(this.customX.value);
            const customY = parseInt(this.customY.value);
            const includeFirstPage = this.firstPageCheckbox.checked;
            
            for (let i = 0; i < pageCount; i++) {
                if (!includeFirstPage && i === 0) {
                    continue;
                }
                
                const pageNum = this.formatPageNumber(
                    includeFirstPage ? startPos + i : startPos + i - 1,
                    format,
                    pageCount
                );
                const page = pdfDoc.getPage(i);
                const { width, height } = page.getSize();
                
                const { x, y } = this.calculatePageNumberPosition(position, customX, customY, width, height);
                
                page.drawText(pageNum, {
                    x: x,
                    y: y,
                    size: fontSize,
                    color: PDFLib.rgb(
                        parseInt(fontColor.substr(1, 2), 16) / 255,
                        parseInt(fontColor.substr(3, 2), 16) / 255,
                        parseInt(fontColor.substr(5, 2), 16) / 255
                    ),
                    opacity: 0.9
                });
                
                // 更新进度
                const progressPercentage = ((i + 1) / pageCount) * 100;
                this.progressFill.style.width = `${progressPercentage}%`;
            }
            
            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            
            this.downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = this.getDownloadFileName();
                a.click();
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            };
            
            this.downloadBtn.style.display = 'inline-block';
            
            this.showSuccess(`页码已成功添加！共处理 ${pageCount} 页。`);
            
        } catch (error) {
            console.error('添加页码时出错:', error);
            this.showError('添加页码时发生错误，请查看控制台了解详情。');
        } finally {
            this.showProgress(false);
        }
    }
    
    formatPageNumber(num, format, totalPageCount = 100) {
        // 确保num是数字
        const pageNum = parseInt(num);
        if (isNaN(pageNum)) {
            return num.toString();
        }
        
        switch(format) {
            case 'i,ii,iii':
                return this.toRomanNumerals(pageNum).toLowerCase();
            case 'I,II,III':
                return this.toRomanNumerals(pageNum);
            case 'a,b,c':
                return String.fromCharCode(96 + (pageNum - 1) % 26 + 1);
            case 'A,B,C':
                return String.fromCharCode(64 + (pageNum - 1) % 26 + 1);
            case '-1-':
                return `-${pageNum}-`;
            case '1/100':
                return `${pageNum}/${totalPageCount}`;
            case 'Page 1':
                return `Page ${pageNum}`;
            case '1,2,3':
            default:
                return pageNum.toString();
        }
    }
    
    toRomanNumerals(num) {
        if (num < 1 || num > 3999) return num.toString();
        
        const lookup = [
            { value: 1000, symbol: 'M' },
            { value: 900, symbol: 'CM' },
            { value: 500, symbol: 'D' },
            { value: 400, symbol: 'CD' },
            { value: 100, symbol: 'C' },
            { value: 90, symbol: 'XC' },
            { value: 50, symbol: 'L' },
            { value: 40, symbol: 'XL' },
            { value: 10, symbol: 'X' },
            { value: 9, symbol: 'IX' },
            { value: 5, symbol: 'V' },
            { value: 4, symbol: 'IV' },
            { value: 1, symbol: 'I' }
        ];
        
        let roman = '';
        for (const item of lookup) {
            while (num >= item.value) {
                roman += item.symbol;
                num -= item.value;
            }
        }
        return roman;
    }
    
    getDownloadFileName() {
        const originalName = this.currentFile ? this.currentFile.name : 'document';
        const dotIndex = originalName.lastIndexOf('.');
        if (dotIndex === -1) {
            return originalName + '_with_pagenums.pdf';
        }
        return originalName.substring(0, dotIndex) + '_with_pagenums.pdf';
    }
    
    showProgress(show, message = null) {
        this.progress.style.display = show ? 'block' : 'none';
        if (show && message) {
            const progressText = this.progress.querySelector('p');
            if (progressText) {
                progressText.textContent = message;
            }
        }
        if (!show) {
            this.progressFill.style.width = '0%';
        }
    }
    
    updateProgress(percentage, message = null) {
        this.progressFill.style.width = `${percentage}%`;
        if (message) {
            const progressText = this.progress.querySelector('p');
            if (progressText) {
                progressText.textContent = message;
            }
        }
    }
    
    showLoadingIndicator(show) {
        this.loadingIndicator.style.display = show ? 'block' : 'none';
    }
    
    showError(message) {
        alert('错误: ' + message);
    }
    
    triggerFileInput() {
        // 检测是否为移动设备
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 移动端：确保文件输入在视口中短暂可见
            const originalStyle = this.fileInput.style.cssText;
            this.fileInput.style.position = 'fixed';
            this.fileInput.style.top = '0';
            this.fileInput.style.left = '0';
            this.fileInput.style.width = '1px';
            this.fileInput.style.height = '1px';
            this.fileInput.style.opacity = '0.1';
            this.fileInput.style.zIndex = '9999';
            
            // 触发点击
            this.fileInput.click();
            
            // 恢复原始样式
            setTimeout(() => {
                this.fileInput.style.cssText = originalStyle;
            }, 100);
        } else {
            // 桌面端：直接触发
            this.fileInput.click();
        }
    }
    
    setupMobileCompatibility() {
        // 检测Chrome移动端
        const isChromeMobile = /Chrome/i.test(navigator.userAgent) && /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isChromeMobile && this.mobileFileBtn) {
            // 为Chrome移动端添加额外的样式
            this.mobileFileBtn.style.touchAction = 'manipulation';
            this.mobileFileBtn.style.webkitTapHighlightColor = 'transparent';
        }
    }
    
    showSuccess(message) {
        alert('成功: ' + message);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new PDFPageNumberAdder();
});