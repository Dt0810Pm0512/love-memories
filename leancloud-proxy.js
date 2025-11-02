// leancloud-proxy.js - 修复版：解决storage adapter问题
class FixedDataSync {
    constructor(config) {
        this.config = config;
        this.data = {
            Photo: [],
            Diary: [],
            Message: [],
            Anniversary: [],
            Setting: []
        };
        this.isReady = false;
        this.syncStatus = 'initializing';
        this.errorMessage = '';
        this.useFallback = false; // 是否使用备用方案
        
        console.log('=== FixedDataSync initialized ===');
        console.log('Trying to fix storage adapter issue...');
        
        this.init();
    }
    
    async init() {
        try {
            this.syncStatus = 'initializing';
            
            // 首先检查浏览器环境
            this.checkBrowserEnvironment();
            
            // 尝试多种方式加载LeanCloud SDK
            await this.loadLeanCloudSDKWithFallback();
            
            // 尝试初始化LeanCloud，处理storage adapter问题
            await this.initializeLeanCloudWithFix();
            
            // 如果初始化成功，加载数据
            if (this.isReady) {
                await this.loadAllData();
                this.showNotification('数据同步服务已就绪！', 'success');
            } else if (this.useFallback) {
                // 如果启用了备用方案
                this.loadLocalBackup();
                this.showNotification('使用本地存储模式', 'info');
            }
            
            this.syncStatus = this.isReady ? 'ready' : 'error';
            
        } catch (error) {
            this.syncStatus = 'error';
            this.errorMessage = error.message || '初始化失败';
            console.error('FixedDataSync initialization failed:', error);
            
            // 尝试加载本地备份
            this.loadLocalBackup();
            
            this.showNotification(`数据同步初始化失败，使用本地模式：${this.errorMessage}`, 'warning');
        }
    }
    
    checkBrowserEnvironment() {
        console.log('=== Checking browser environment ===');
        
        // 检查localStorage可用性
        try {
            const testKey = '__fixed_ds_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            console.log('localStorage is available');
        } catch (error) {
            console.error('localStorage is not available:', error);
            this.showNotification('浏览器存储不可用，功能可能受限', 'warning');
        }
        
        // 检查其他存储机制
        if (typeof sessionStorage !== 'undefined') {
            console.log('sessionStorage is available');
        }
        
        if (typeof indexedDB !== 'undefined') {
            console.log('indexedDB is available');
        }
    }
    
    loadLeanCloudSDKWithFallback() {
        return new Promise((resolve, reject) => {
            console.log('=== Loading LeanCloud SDK with fallback ===');
            
            // 尝试多个CDN源
            const cdnSources = [
                'https://cdn.jsdelivr.net/npm/leancloud-storage@4.12.0/dist/av-min.js',
                'https://unpkg.com/leancloud-storage@4.12.0/dist/av-min.js',
                'https://cdn.jsdelivr.net/npm/leancloud-storage@4.11.0/dist/av-min.js', // 尝试不同版本
                'https://cdn.jsdelivr.net/npm/leancloud-storage@4.10.0/dist/av-min.js'
            ];
            
            let currentSourceIndex = 0;
            
            const tryNextSource = () => {
                if (currentSourceIndex >= cdnSources.length) {
                    console.error('All CDN sources failed');
                    reject(new Error('LeanCloud SDK加载失败，所有CDN源都不可用'));
                    return;
                }
                
                const source = cdnSources[currentSourceIndex];
                currentSourceIndex++;
                
                console.log(`Trying to load SDK from: ${source}`);
                
                const script = document.createElement('script');
                script.src = source;
                script.async = false;
                
                let timeoutId = setTimeout(() => {
                    console.error(`SDK load timeout for ${source}`);
                    script.onerror(); // 触发错误处理
                }, 10000); // 10秒超时
                
                script.onload = () => {
                    clearTimeout(timeoutId);
                    console.log(`Successfully loaded SDK from ${source}`);
                    
                    if (window.AV) {
                        console.log('AV object is available');
                        console.log('AV.version:', window.AV.version);
                        resolve();
                    } else {
                        console.error('AV object is not available after script load');
                        tryNextSource();
                    }
                };
                
                script.onerror = () => {
                    clearTimeout(timeoutId);
                    console.error(`Failed to load SDK from ${source}`);
                    tryNextSource();
                };
                
                document.head.appendChild(script);
            };
            
            tryNextSource();
        });
    }
    
    async initializeLeanCloudWithFix() {
        console.log('=== Initializing LeanCloud with storage adapter fix ===');
        
        try {
            if (typeof AV === 'undefined') {
                throw new Error('AV object is not available');
            }
            
            console.log('LeanCloud config:', {
                appId: this.config.appId ? '***' : 'missing',
                appKey: this.config.appKey ? '***' : 'missing',
                serverURL: this.config.serverURL
            });
            
            if (!this.config.appId || !this.config.appKey) {
                throw new Error('LeanCloud配置不完整');
            }
            
            // 尝试修复storage adapter问题的方法
            this.fixStorageAdapter();
            
            // 初始化LeanCloud
            console.log('Calling AV.init()');
            AV.init({
                appId: this.config.appId,
                appKey: this.config.appKey,
                serverURL: this.config.serverURL || 'https://leancloud.cn'
            });
            
            console.log('AV.init() completed');
            
            // 验证初始化结果
            await this.verifyLeanCloudInitialization();
            
            this.isReady = true;
            console.log('LeanCloud initialized successfully with fix');
            
        } catch (error) {
            console.error('LeanCloud initialization failed:', error);
            
            // 如果初始化失败，询问是否使用备用方案
            if (confirm(`LeanCloud初始化失败：${error.message}\n\n是否使用本地存储模式？（数据仅保存在当前设备）`)) {
                this.useFallback = true;
                this.isReady = true; // 虽然没有LeanCloud，但本地模式是就绪的
                console.log('User chose to use fallback local storage mode');
            } else {
                throw error;
            }
        }
    }
    
    fixStorageAdapter() {
        console.log('=== Trying to fix storage adapter ===');
        
        try {
            // 方法1：提前创建存储适配器
            if (typeof AV !== 'undefined' && AV.Storage) {
                console.log('Trying to create storage adapter manually');
                const adapter = AV.Storage.Adapter.getInstance();
                console.log('Storage adapter created:', adapter);
            }
            
            // 方法2：检查并修复localStorage适配器
            if (typeof localStorage !== 'undefined') {
                console.log('Checking localStorage adapter');
                
                // 尝试提前设置一些值
                const testKey = 'avoscloud:sdk:test';
                localStorage.setItem(testKey, 'test_value');
                localStorage.removeItem(testKey);
                console.log('localStorage test passed');
            }
            
            // 方法3：为AV对象添加缺失的适配器方法（如果需要）
            if (typeof AV !== 'undefined' && !AV.getAdapter) {
                console.log('Adding missing getAdapter method to AV');
                AV.getAdapter = function(name) {
                    console.log('AV.getAdapter called with:', name);
                    if (name === 'storage') {
                        return {
                            getItem: function(key) {
                                return localStorage.getItem(key);
                            },
                            setItem: function(key, value) {
                                return localStorage.setItem(key, value);
                            },
                            removeItem: function(key) {
                                return localStorage.removeItem(key);
                            }
                        };
                    }
                    return null;
                };
            }
            
            console.log('Storage adapter fix attempts completed');
            
        } catch (error) {
            console.error('Storage adapter fix failed:', error);
        }
    }
    
    async verifyLeanCloudInitialization() {
        console.log('=== Verifying LeanCloud initialization ===');
        
        try {
            // 创建一个测试对象
            const TestObject = AV.Object.extend('TestObject');
            const testObject = new TestObject();
            testObject.set('testKey', 'testValue');
            
            console.log('Saving test object...');
            const result = await testObject.save();
            console.log('Test object saved successfully:', result.id);
            
            // 立即删除测试对象
            await result.destroy();
            console.log('Test object deleted successfully');
            
            console.log('LeanCloud verification passed');
            return true;
            
        } catch (error) {
            console.error('LeanCloud verification failed:', error);
            
            // 如果是storage adapter错误，尝试其他方法
            if (error.message && error.message.includes('storage adapter')) {
                console.log('Storage adapter error detected, trying fallback...');
                
                // 方法1：使用内存存储
                if (typeof AV !== 'undefined' && AV.Storage) {
                    console.log('Trying to use memory storage');
                    AV.Storage.setAdapter({
                        getItem: function(key) {
                            return this.memory[key];
                        }.bind({ memory: {} }),
                        setItem: function(key, value) {
                            this.memory[key] = value;
                        }.bind({ memory: {} }),
                        removeItem: function(key) {
                            delete this.memory[key];
                        }.bind({ memory: {} })
                    });
                }
                
                // 再次尝试验证
                try {
                    await this.verifyLeanCloudInitialization();
                    return true;
                } catch (secondError) {
                    console.error('Second verification failed:', secondError);
                    throw error;
                }
            }
            
            throw error;
        }
    }
    
    async loadAllData() {
        try {
            this.syncStatus = 'syncing';
            this.showNotification('正在同步云端数据...', 'info');
            
            const dataTypes = ['Photo', 'Diary', 'Message', 'Anniversary', 'Setting'];
            const promises = dataTypes.map(type => this.loadDataType(type));
            
            await Promise.all(promises);
            
            this.syncStatus = 'ready';
            this.showNotification('云端数据同步完成！', 'success');
            
            // 保存到本地备份
            this.saveLocalBackup();
            
            return true;
        } catch (error) {
            console.error('Failed to load all data:', error);
            this.syncStatus = 'error';
            this.errorMessage = `数据加载失败：${error.message}`;
            this.showNotification(this.errorMessage, 'error');
            
            // 尝试加载本地备份
            this.loadLocalBackup();
            
            return false;
        }
    }
    
    async loadDataType(type) {
        try {
            console.log(`Loading ${type} data from LeanCloud...`);
            
            // 如果使用备用方案，直接返回空数据
            if (this.useFallback) {
                return [];
            }
            
            const Table = AV.Object.extend(type);
            const query = new AV.Query(Table);
            query.descending('createdAt');
            
            const results = await query.find();
            const data = results.map(result => ({
                id: result.id,
                ...result.toJSON(),
                isLocal: false
            }));
            
            this.data[type] = data;
            console.log(`Loaded ${data.length} ${type} items`);
            
            return data;
        } catch (error) {
            console.error(`Failed to load ${type} data:`, error);
            
            // 如果是storage adapter错误，切换到备用方案
            if (error.message && error.message.includes('storage adapter') && !this.useFallback) {
                console.log('Switching to fallback mode due to storage adapter error');
                this.useFallback = true;
                this.loadLocalBackup();
                this.showNotification('切换到本地存储模式', 'warning');
            }
            
            return [];
        }
    }
    
    async addItem(type, itemData) {
        try {
            if (!this.isReady) {
                throw new Error('数据同步服务未就绪');
            }
            
            const newItem = {
                ...itemData,
                id: this.generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isLocal: this.useFallback
            };
            
            // 添加到本地数据
            this.data[type] = [newItem, ...this.data[type]];
            
            // 保存到本地备份
            this.saveLocalBackup();
            
            // 如果不是备用模式，尝试同步到云端
            if (!this.useFallback) {
                try {
                    await this.addItemToCloud(type, newItem);
                    newItem.isLocal = false;
                    this.showNotification(`${this.getTableNameCN(type)}添加成功！`, 'success');
                } catch (cloudError) {
                    console.error(`Failed to sync ${type} to cloud:`, cloudError);
                    this.showNotification(`${this.getTableNameCN(type)}已保存到本地，云端同步失败`, 'warning');
                }
            } else {
                this.showNotification(`${this.getTableNameCN(type)}添加成功！`, 'success');
            }
            
            return newItem;
        } catch (error) {
            console.error(`Failed to add ${type} item:`, error);
            this.showNotification(`添加失败：${error.message}`, 'error');
            return null;
        }
    }
    
    async addItemToCloud(type, item) {
        try {
            console.log(`Adding ${type} item to cloud:`, item.id);
            
            const Table = AV.Object.extend(type);
            const table = new Table();
            
            // 过滤掉内部字段
            const filteredData = { ...item };
            ['id', 'isLocal', 'createdAt', 'updatedAt'].forEach(key => {
                delete filteredData[key];
            });
            
            Object.keys(filteredData).forEach(key => {
                table.set(key, filteredData[key]);
            });
            
            const result = await table.save();
            console.log(`Added ${type} item to cloud successfully:`, result.id);
            
            return result;
        } catch (error) {
            console.error(`Failed to add ${type} item to cloud:`, error);
            throw error;
        }
    }
    
    async updateItem(type, id, itemData) {
        try {
            if (!this.isReady) {
                throw new Error('数据同步服务未就绪');
            }
            
            const index = this.data[type].findIndex(item => item.id === id);
            if (index === -1) {
                throw new Error(`${this.getTableNameCN(type)}不存在`);
            }
            
            const updatedItem = {
                ...this.data[type][index],
                ...itemData,
                updatedAt: new Date().toISOString()
            };
            
            this.data[type][index] = updatedItem;
            
            // 保存到本地备份
            this.saveLocalBackup();
            
            // 如果不是备用模式，尝试同步到云端
            if (!this.useFallback && !updatedItem.isLocal) {
                try {
                    await this.updateItemInCloud(type, updatedItem);
                    this.showNotification(`${this.getTableNameCN(type)}更新成功！`, 'success');
                } catch (cloudError) {
                    console.error(`Failed to sync ${type} update to cloud:`, cloudError);
                    this.showNotification(`${this.getTableNameCN(type)}已更新到本地，云端同步失败`, 'warning');
                }
            } else {
                this.showNotification(`${this.getTableNameCN(type)}更新成功！`, 'success');
            }
            
            return updatedItem;
        } catch (error) {
            console.error(`Failed to update ${type} item:`, error);
            this.showNotification(`更新失败：${error.message}`, 'error');
            return null;
        }
    }
    
    async updateItemInCloud(type, item) {
        try {
            console.log(`Updating ${type} item in cloud:`, item.id);
            
            const Table = AV.Object.extend(type);
            const table = AV.Object.createWithoutData(Table, item.id);
            
            // 过滤掉内部字段
            const filteredData = { ...item };
            ['id', 'isLocal', 'createdAt', 'updatedAt'].forEach(key => {
                delete filteredData[key];
            });
            
            Object.keys(filteredData).forEach(key => {
                table.set(key, filteredData[key]);
            });
            
            await table.save();
            console.log(`Updated ${type} item in cloud successfully:`, item.id);
            
            return true;
        } catch (error) {
            console.error(`Failed to update ${type} item in cloud:`, error);
            throw error;
        }
    }
    
    async deleteItem(type, id) {
        try {
            if (!this.isReady) {
                throw new Error('数据同步服务未就绪');
            }
            
            const index = this.data[type].findIndex(item => item.id === id);
            if (index === -1) {
                throw new Error(`${this.getTableNameCN(type)}不存在`);
            }
            
            const deletedItem = this.data[type][index];
            
            // 从本地数据中删除
            this.data[type].splice(index, 1);
            
            // 保存到本地备份
            this.saveLocalBackup();
            
            // 如果不是备用模式，尝试同步到云端
            if (!this.useFallback && !deletedItem.isLocal) {
                try {
                    await this.deleteItemFromCloud(type, deletedItem.id);
                    this.showNotification(`${this.getTableNameCN(type)}删除成功！`, 'success');
                } catch (cloudError) {
                    console.error(`Failed to sync ${type} deletion to cloud:`, cloudError);
                    this.showNotification(`${this.getTableNameCN(type)}已从本地删除，云端同步失败`, 'warning');
                }
            } else {
                this.showNotification(`${this.getTableNameCN(type)}删除成功！`, 'success');
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to delete ${type} item:`, error);
            this.showNotification(`删除失败：${error.message}`, 'error');
            return false;
        }
    }
    
    async deleteItemFromCloud(type, id) {
        try {
            console.log(`Deleting ${type} item from cloud:`, id);
            
            const Table = AV.Object.extend(type);
            const table = AV.Object.createWithoutData(Table, id);
            
            await table.destroy();
            console.log(`Deleted ${type} item from cloud successfully:`, id);
            
            return true;
        } catch (error) {
            console.error(`Failed to delete ${type} item from cloud:`, error);
            throw error;
        }
    }
    
    async uploadFile(file, fileName = null) {
        try {
            if (!this.isReady) {
                throw new Error('数据同步服务未就绪');
            }
            
            // 如果是备用模式，使用base64上传
            if (this.useFallback) {
                return this.uploadBase64Fallback(file, fileName);
            }
            
            const name = fileName || file.name;
            const avFile = new AV.File(name, file);
            
            this.showNotification('正在上传文件...', 'info');
            const result = await avFile.save();
            
            this.showNotification('文件上传成功！', 'success');
            return {
                url: result.url(),
                name: result.name(),
                size: result.size(),
                id: result.id
            };
        } catch (error) {
            console.error('Failed to upload file:', error);
            
            // 如果上传失败，尝试使用base64备用方案
            try {
                const fallbackResult = await this.uploadBase64Fallback(file, fileName);
                this.showNotification('文件上传失败，已使用备用方案保存到本地', 'warning');
                return fallbackResult;
            } catch (fallbackError) {
                this.showNotification(`文件上传失败：${error.message}`, 'error');
                return null;
            }
        }
    }
    
    async uploadBase64Fallback(file, fileName = null) {
        try {
            console.log('Using base64 fallback for file upload');
            
            if (file.size > 5 * 1024 * 1024) { // 5MB限制
                throw new Error('文件大小超过5MB限制');
            }
            
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    resolve({
                        url: e.target.result,
                        name: fileName || file.name,
                        size: file.size,
                        id: 'local_' + Date.now(),
                        isLocal: true
                    });
                };
                reader.readAsDataURL(file);
            });
        } catch (error) {
            console.error('Base64 fallback upload failed:', error);
            throw error;
        }
    }
    
    async uploadBase64(base64Data, fileName, mimeType = 'image/jpeg') {
        try {
            if (!this.isReady) {
                throw new Error('数据同步服务未就绪');
            }
            
            // 如果是备用模式，直接返回base64数据
            if (this.useFallback) {
                return {
                    url: base64Data,
                    name: fileName,
                    size: base64Data.length,
                    id: 'local_' + Date.now(),
                    isLocal: true
                };
            }
            
            const base64WithoutPrefix = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = atob(base64WithoutPrefix);
            const arrayBuffer = new ArrayBuffer(binaryData.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }
            
            const blob = new Blob([uint8Array], { type: mimeType });
            const file = new File([blob], fileName, { type: mimeType });
            
            return this.uploadFile(file, fileName);
        } catch (error) {
            console.error('Failed to upload base64 data:', error);
            this.showNotification('图片上传失败！', 'error');
            return null;
        }
    }
    
    async syncAllData() {
        if (this.syncStatus === 'syncing' || this.useFallback) {
            console.warn('Sync not available in current state');
            return false;
        }
        
        try {
            this.syncStatus = 'syncing';
            this.showNotification('正在同步数据...', 'info');
            
            // 同步所有本地修改到云端
            await this.syncLocalChanges();
            
            // 从云端加载最新数据
            await this.loadAllData();
            
            this.syncStatus = 'ready';
            this.showNotification('数据同步完成！', 'success');
            return true;
        } catch (error) {
            this.syncStatus = 'error';
            this.errorMessage = `同步失败：${error.message}`;
            console.error('Sync error:', error);
            this.showNotification(this.errorMessage, 'error');
            return false;
        }
    }
    
    async syncLocalChanges() {
        try {
            const dataTypes = ['Photo', 'Diary', 'Message', 'Anniversary', 'Setting'];
            
            for (const type of dataTypes) {
                const localItems = this.data[type].filter(item => item.isLocal);
                if (localItems.length === 0) continue;
                
                console.log(`Syncing ${localItems.length} local ${type} items to cloud...`);
                
                for (const item of localItems) {
                    try {
                        if (item.id.startsWith('local_')) {
                            await this.addItemToCloud(type, item);
                        } else {
                            await this.updateItemInCloud(type, item);
                        }
                        item.isLocal = false;
                    } catch (error) {
                        console.error(`Failed to sync ${type} item ${item.id}:`, error);
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to sync local changes:', error);
            throw error;
        }
    }
    
    generateId() {
        return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    saveLocalBackup() {
        try {
            console.log('Saving local backup...');
            const backupData = {
                data: this.data,
                timestamp: new Date().toISOString(),
                useFallback: this.useFallback
            };
            
            localStorage.setItem('loveSiteBackup', JSON.stringify(backupData));
            console.log('Local backup saved successfully');
        } catch (error) {
            console.error('Failed to save local backup:', error);
        }
    }
    
    loadLocalBackup() {
        try {
            console.log('Loading local backup...');
            const backupStr = localStorage.getItem('loveSiteBackup');
            if (!backupStr) {
                console.log('No local backup found');
                return false;
            }
            
            const backupData = JSON.parse(backupStr);
            if (backupData && backupData.data) {
                this.data = backupData.data;
                this.useFallback = backupData.useFallback || false;
                console.log('Local backup loaded successfully');
                return true;
            }
            
            console.log('Invalid local backup data');
            return false;
        } catch (error) {
            console.error('Failed to load local backup:', error);
            return false;
        }
    }
    
    getData(type) {
        return this.data[type] || [];
    }
    
    getSyncStatus() {
        return {
            status: this.syncStatus,
            error: this.errorMessage,
            isReady: this.isReady,
            useFallback: this.useFallback,
            mode: this.useFallback ? 'local_fallback' : 'leancloud'
        };
    }
    
    getTableNameCN(tableName) {
        const tableNames = {
            'Photo': '照片',
            'Diary': '日记',
            'Message': '留言',
            'Anniversary': '纪念日',
            'Setting': '设置'
        };
        return tableNames[tableName] || tableName;
    }
    
    showNotification(message, type = 'info') {
        console.log(`[NOTIFICATION] [${type.toUpperCase()}] ${message}`);
        
        if (window.showNotification) {
            try {
                window.showNotification(message, type);
            } catch (error) {
                console.error('Failed to call window.showNotification:', error);
            }
        }
    }
    
    onDataUpdated(callback) {
        // 这个版本简化了监听器机制
        console.log('Data update listener not implemented in fixed version');
    }
}

// 全局初始化函数
window.initFixedDataSync = function(config) {
    console.log('window.initFixedDataSync called with config:', config);
    return new FixedDataSync(config);
};

// 全局同步状态管理
window.syncStatus = {
    getStatus: function() {
        if (window.dataSync) {
            return window.dataSync.getSyncStatus();
        }
        return { status: 'not_initialized', isReady: false, mode: 'unknown' };
    },
    
    forceSync: function() {
        console.log('window.syncStatus.forceSync called');
        if (window.dataSync) {
            return window.dataSync.syncAllData();
        }
        console.warn('window.dataSync is not available');
        return Promise.resolve(false);
    },
    
    showStatus: function() {
        console.log('window.syncStatus.showStatus called');
        const status = this.getStatus();
        let message = '';
        let type = 'info';
        
        switch (status.mode) {
            case 'local_fallback':
                message = '当前使用本地存储模式，数据保存在浏览器中';
                type = 'warning';
                break;
            case 'leancloud':
                switch (status.status) {
                    case 'ready':
                        message = 'LeanCloud同步模式正常运行';
                        type = 'success';
                        break;
                    case 'syncing':
                        message = '正在同步数据...';
                        type = 'info';
                        break;
                    case 'error':
                        message = `同步服务异常：${status.error}`;
                        type = 'error';
                        break;
                    default:
                        message = '数据同步服务初始化中...';
                        type = 'info';
                }
                break;
            default:
                message = '数据服务初始化中...';
                type = 'info';
        }
        
        console.log(`[SYNC STATUS] ${message}`);
        
        if (window.showNotification) {
            window.showNotification(message, type);
        }
        
        return { message, type };
    }
};

console.log('=== FixedDataSync script loaded ===');
console.log('This version includes fixes for storage adapter issues');