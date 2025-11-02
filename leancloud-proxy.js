// leancloud-proxy.js - 简化可靠的数据同步服务
class SimpleDataSync {
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
        this.syncStatus = 'initializing'; // initializing, ready, syncing, error
        this.errorMessage = '';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.updateListeners = [];
        
        console.log('SimpleDataSync constructor called with config:', {
            appId: config.appId ? '***' : 'missing',
            appKey: config.appKey ? '***' : 'missing',
            serverURL: config.serverURL
        });
        
        this.init();
    }
    
    async init() {
        try {
            this.syncStatus = 'initializing';
            console.log('=== Starting SimpleDataSync initialization ===');
            
            // 首先检查浏览器环境
            this.checkBrowserEnvironment();
            
            // 加载LeanCloud SDK
            await this.loadLeanCloudSDK();
            
            // 初始化LeanCloud
            await this.initializeLeanCloud();
            
            // 验证LeanCloud初始化是否成功
            await this.verifyLeanCloudInitialization();
            
            // 加载云端数据
            await this.loadAllData();
            
            // 加载本地备份（如果云端数据为空）
            this.loadLocalBackup();
            
            this.syncStatus = 'ready';
            this.isReady = true;
            this.retryCount = 0;
            console.log('=== SimpleDataSync initialized successfully! ===');
            this.showNotification('数据同步服务已就绪！', 'success');
            
            // 启动自动同步
            this.startAutoSync();
            
            return true;
        } catch (error) {
            this.syncStatus = 'error';
            this.errorMessage = error.message || '初始化失败';
            console.error('=== SimpleDataSync initialization failed:', error, '===');
            this.showNotification(`数据同步服务初始化失败：${this.errorMessage}`, 'error');
            
            // 尝试加载本地备份
            this.loadLocalBackup();
            
            return false;
        }
    }
    
    checkBrowserEnvironment() {
        console.log('Checking browser environment...');
        
        if (typeof window === 'undefined') {
            throw new Error('This script must be run in a browser environment');
        }
        
        if (typeof localStorage === 'undefined') {
            console.warn('LocalStorage is not available, some features may not work');
        }
        
        console.log('Browser environment check passed');
    }
    
    loadLeanCloudSDK() {
        return new Promise((resolve, reject) => {
            console.log('=== Loading LeanCloud SDK ===');
            
            if (window.AV) {
                console.log('LeanCloud SDK already exists in window');
                this.checkAVObject(window.AV);
                resolve();
                return;
            }
            
            console.log('Creating script element to load LeanCloud SDK');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/leancloud-storage@4.12.0/dist/av-min.js';
            script.async = false; // 同步加载，确保SDK完全加载后再继续
            
            script.onload = () => {
                console.log('LeanCloud SDK script loaded event fired');
                setTimeout(() => {
                    if (window.AV) {
                        console.log('LeanCloud SDK loaded successfully, AV is in window');
                        this.checkAVObject(window.AV);
                        resolve();
                    } else {
                        console.error('LeanCloud SDK script loaded but AV is not in window');
                        reject(new Error('LeanCloud SDK加载失败，AV对象未定义'));
                    }
                }, 100); // 给一点时间让SDK初始化
            };
            
            script.onerror = (error) => {
                console.error('LeanCloud SDK script load error:', error);
                reject(new Error(`LeanCloud SDK加载失败：${error.message || '网络错误'}`));
            };
            
            script.onabort = () => {
                console.error('LeanCloud SDK script load aborted');
                reject(new Error('LeanCloud SDK加载被中止'));
            };
            
            console.log('Appending script to document head');
            document.head.appendChild(script);
            
            // 添加超时检查
            setTimeout(() => {
                if (!window.AV) {
                    console.error('LeanCloud SDK load timeout after 5 seconds');
                    reject(new Error('LeanCloud SDK加载超时'));
                }
            }, 5000);
        });
    }
    
    checkAVObject(AV) {
        console.log('Checking AV object structure...');
        console.log('AV.version:', AV.version);
        console.log('AV.Object:', typeof AV.Object);
        console.log('AV.Query:', typeof AV.Query);
        console.log('AV.File:', typeof AV.File);
        console.log('AV.init:', typeof AV.init);
        
        if (typeof AV.Object !== 'function') {
            console.warn('AV.Object is not a function, this may cause issues');
        }
        
        if (typeof AV.init !== 'function') {
            console.error('AV.init is not a function, LeanCloud SDK is invalid');
        }
    }
    
    initializeLeanCloud() {
        return new Promise((resolve, reject) => {
            console.log('=== Initializing LeanCloud ===');
            
            try {
                if (typeof AV === 'undefined') {
                    console.error('AV is undefined, cannot initialize LeanCloud');
                    reject(new Error('LeanCloud SDK未正确加载，AV对象不存在'));
                    return;
                }
                
                console.log('LeanCloud config before init:', {
                    appId: this.config.appId ? '***' : 'missing',
                    appKey: this.config.appKey ? '***' : 'missing',
                    serverURL: this.config.serverURL
                });
                
                if (!this.config.appId || !this.config.appKey) {
                    const errorMsg = 'LeanCloud配置不完整，App ID和App Key都是必需的';
                    console.error(errorMsg);
                    reject(new Error(errorMsg));
                    return;
                }
                
                console.log('Calling AV.init()');
                const initResult = AV.init({
                    appId: this.config.appId,
                    appKey: this.config.appKey,
                    serverURL: this.config.serverURL || 'https://leancloud.cn'
                });
                
                console.log('AV.init() returned:', initResult);
                
                // 验证初始化是否成功
                setTimeout(() => {
                    try {
                        console.log('Verifying LeanCloud initialization');
                        console.log('AV.applicationId:', AV.applicationId);
                        console.log('AV.applicationKey:', AV.applicationKey ? '***' : 'missing');
                        console.log('AV.serverURL:', AV.serverURL);
                        
                        if (AV.applicationId === this.config.appId) {
                            console.log('LeanCloud initialized successfully');
                            resolve();
                        } else {
                            console.error('LeanCloud initialization verification failed');
                            reject(new Error('LeanCloud初始化验证失败'));
                        }
                    } catch (error) {
                        console.error('Error verifying LeanCloud initialization:', error);
                        reject(new Error(`LeanCloud初始化验证失败：${error.message}`));
                    }
                }, 500);
                
            } catch (error) {
                console.error('LeanCloud initialization error:', error);
                reject(new Error(`LeanCloud初始化失败：${error.message}`));
            }
        });
    }
    
    async verifyLeanCloudInitialization() {
        console.log('=== Verifying LeanCloud initialization ===');
        
        try {
            // 创建一个测试对象来验证存储适配器是否正常工作
            const TestObject = AV.Object.extend('TestObject');
            const testObject = new TestObject();
            testObject.set('testKey', 'testValue');
            
            console.log('Saving test object to verify storage adapter');
            const result = await testObject.save();
            console.log('Test object saved successfully, result:', {
                id: result.id,
                createdAt: result.createdAt
            });
            
            // 清理测试数据
            await result.destroy();
            console.log('Test object deleted successfully');
            
            console.log('LeanCloud storage adapter verification passed');
            return true;
            
        } catch (error) {
            console.error('LeanCloud storage adapter verification failed:', error);
            
            // 如果测试失败，仍然继续初始化，但记录警告
            console.warn('LeanCloud storage adapter verification failed, but continuing initialization');
            this.showNotification('数据存储验证失败，但仍将尝试继续使用', 'warning');
            
            return false;
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
            
            // 通知所有监听器数据已更新
            this.notifyDataUpdated();
            
            return true;
        } catch (error) {
            console.error('Failed to load all data:', error);
            this.syncStatus = 'error';
            this.errorMessage = `数据加载失败：${error.message}`;
            this.showNotification(this.errorMessage, 'error');
            return false;
        }
    }
    
    async loadDataType(type) {
        try {
            console.log(`=== Loading ${type} data from LeanCloud ===`);
            
            // 确保AV对象存在
            if (typeof AV === 'undefined') {
                throw new Error('LeanCloud SDK未正确加载，AV对象不存在');
            }
            
            const Table = AV.Object.extend(type);
            console.log(`Created ${type} class from AV.Object.extend`);
            
            const query = new AV.Query(Table);
            console.log(`Created AV.Query for ${type}`);
            
            query.descending('createdAt');
            console.log('Set query to sort by createdAt descending');
            
            console.log('Executing query.find()');
            const results = await query.find();
            console.log(`Query returned ${results.length} ${type} items`);
            
            const data = results.map(result => ({
                id: result.id,
                ...result.toJSON(),
                isLocal: false
            }));
            
            this.data[type] = data;
            console.log(`Loaded ${data.length} ${type} items successfully`);
            
            return data;
        } catch (error) {
            console.error(`Failed to load ${type} data:`, error);
            
            // 如果是存储适配器错误，提供更详细的信息
            if (error.message && error.message.includes('storage adapter')) {
                console.error('Storage adapter error detected, this usually means LeanCloud SDK is not properly initialized');
                console.error('AV object state:', typeof AV !== 'undefined' ? 'exists' : 'undefined');
                if (AV) {
                    console.error('AV.applicationId:', AV.applicationId);
                    console.error('AV.serverURL:', AV.serverURL);
                }
            }
            
            // 如果加载失败，不抛出错误，继续加载其他数据类型
            return [];
        }
    }
    
    async syncAllData() {
        if (this.syncStatus === 'syncing') {
            console.warn('Sync already in progress');
            return false;
        }
        
        try {
            this.syncStatus = 'syncing';
            this.showNotification('正在同步数据...', 'info');
            
            // 先保存所有本地修改到云端
            await this.saveAllLocalChanges();
            
            // 再从云端加载最新数据
            await this.loadAllData();
            
            this.syncStatus = 'ready';
            this.retryCount = 0;
            this.showNotification('数据同步完成！', 'success');
            return true;
        } catch (error) {
            this.syncStatus = 'error';
            this.errorMessage = `同步失败：${error.message}`;
            console.error('Sync error:', error);
            this.showNotification(this.errorMessage, 'error');
            
            // 自动重试
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => {
                    console.log(`Retrying sync (${this.retryCount}/${this.maxRetries})...`);
                    this.syncAllData();
                }, 3000);
            }
            
            return false;
        }
    }
    
    async saveAllLocalChanges() {
        try {
            const dataTypes = ['Photo', 'Diary', 'Message', 'Anniversary', 'Setting'];
            
            for (const type of dataTypes) {
                const localItems = this.data[type].filter(item => item.isLocal);
                if (localItems.length === 0) continue;
                
                console.log(`Saving ${localItems.length} local ${type} items to cloud...`);
                
                for (const item of localItems) {
                    if (item.isNew) {
                        await this.addItemToCloud(type, item);
                    } else if (item.isModified) {
                        await this.updateItemInCloud(type, item);
                    } else if (item.isDeleted) {
                        await this.deleteItemFromCloud(type, item);
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to save local changes:', error);
            throw error;
        }
    }
    
    async addItem(type, itemData) {
        try {
            if (!this.isReady) {
                throw new Error('数据同步服务未就绪');
            }
            
            const newItem = {
                ...itemData,
                id: this.generateTempId(),
                updatedAt: new Date(),
                timestamp: new Date().toISOString(),
                isLocal: true,
                isNew: true
            };
            
            // 添加到本地数据
            this.data[type] = [newItem, ...this.data[type]];
            
            // 立即保存到本地备份
            this.saveLocalBackup();
            
            // 通知监听器数据已更新
            this.notifyDataUpdated(type, this.data[type]);
            
            // 显示成功消息
            this.showNotification(`${this.getTableNameCN(type)}添加成功！`, 'success');
            
            // 尝试同步到云端
            setTimeout(() => {
                this.syncAllData();
            }, 1000);
            
            return newItem;
        } catch (error) {
            console.error(`Failed to add ${type} item:`, error);
            this.showNotification(`添加失败：${error.message}`, 'error');
            
            // 即使同步失败，也保存到本地
            try {
                const offlineItem = {
                    ...itemData,
                    id: this.generateTempId(),
                    updatedAt: new Date(),
                    timestamp: new Date().toISOString(),
                    isLocal: true,
                    isNew: true,
                    syncFailed: true
                };
                
                this.data[type] = [offlineItem, ...this.data[type]];
                this.saveLocalBackup();
                this.notifyDataUpdated(type, this.data[type]);
                this.showNotification(`${this.getTableNameCN(type)}已保存到本地，网络恢复后将自动同步`, 'warning');
                return offlineItem;
            } catch (offlineError) {
                console.error('Failed to save offline item:', offlineError);
                return null;
            }
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
                updatedAt: new Date(),
                timestamp: new Date().toISOString(),
                isLocal: true,
                isModified: true,
                isNew: false
            };
            
            this.data[type][index] = updatedItem;
            
            // 立即保存到本地备份
            this.saveLocalBackup();
            
            // 通知监听器数据已更新
            this.notifyDataUpdated(type, this.data[type]);
            
            this.showNotification(`${this.getTableNameCN(type)}更新成功！`, 'success');
            
            // 尝试同步到云端
            setTimeout(() => {
                this.syncAllData();
            }, 1000);
            
            return updatedItem;
        } catch (error) {
            console.error(`Failed to update ${type} item:`, error);
            this.showNotification(`更新失败：${error.message}`, 'error');
            return null;
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
            
            // 如果是云端数据，标记为待删除
            if (!deletedItem.isLocal || deletedItem.isNew === false) {
                deletedItem.isDeleted = true;
                deletedItem.isLocal = true;
                this.notifyDataUpdated(type, this.data[type]);
            } else {
                // 如果是纯本地数据，直接删除
                this.data[type].splice(index, 1);
                this.notifyDataUpdated(type, this.data[type]);
            }
            
            // 立即保存到本地备份
            this.saveLocalBackup();
            
            this.showNotification(`${this.getTableNameCN(type)}删除成功！`, 'success');
            
            // 尝试同步到云端
            setTimeout(() => {
                this.syncAllData();
            }, 1000);
            
            return true;
        } catch (error) {
            console.error(`Failed to delete ${type} item:`, error);
            this.showNotification(`删除失败：${error.message}`, 'error');
            
            // 即使同步失败，也从本地删除
            try {
                this.data[type] = this.data[type].filter(item => item.id !== id);
                this.saveLocalBackup();
                this.notifyDataUpdated(type, this.data[type]);
                this.showNotification(`${this.getTableNameCN(type)}已从本地删除`, 'info');
                return true;
            } catch (offlineError) {
                console.error('Failed to delete offline item:', offlineError);
                return false;
            }
        }
    }
    
    async addItemToCloud(type, item) {
        try {
            console.log(`Adding ${type} item to cloud:`, item.id);
            
            // 确保AV对象存在
            if (typeof AV === 'undefined') {
                throw new Error('LeanCloud SDK未正确加载');
            }
            
            const Table = AV.Object.extend(type);
            const table = new Table();
            
            // 过滤掉内部字段和保留字段
            const filteredData = { ...item };
            ['id', 'isLocal', 'isNew', 'isModified', 'isDeleted', 'syncFailed', 'createdAt', 'updatedAt'].forEach(key => {
                delete filteredData[key];
            });
            
            Object.keys(filteredData).forEach(key => {
                table.set(key, filteredData[key]);
            });
            
            const result = await table.save();
            
            // 更新本地数据的ID和状态
            const index = this.data[type].findIndex(i => i.id === item.id);
            if (index !== -1) {
                this.data[type][index] = {
                    id: result.id,
                    ...result.toJSON(),
                    isLocal: false,
                    isNew: false,
                    isModified: false,
                    isDeleted: false
                };
                this.notifyDataUpdated(type, this.data[type]);
            }
            
            console.log(`Added ${type} item to cloud successfully:`, result.id);
            return true;
        } catch (error) {
            console.error(`Failed to add ${type} item to cloud:`, error);
            // 标记为同步失败
            const index = this.data[type].findIndex(i => i.id === item.id);
            if (index !== -1) {
                this.data[type][index].syncFailed = true;
                this.notifyDataUpdated(type, this.data[type]);
            }
            throw error;
        }
    }
    
    async updateItemInCloud(type, item) {
        try {
            console.log(`Updating ${type} item in cloud:`, item.id);
            
            // 确保AV对象存在
            if (typeof AV === 'undefined') {
                throw new Error('LeanCloud SDK未正确加载');
            }
            
            // 如果是临时ID，先添加到云端
            if (item.id.startsWith('temp_')) {
                return this.addItemToCloud(type, item);
            }
            
            const Table = AV.Object.extend(type);
            const table = AV.Object.createWithoutData(Table, item.id);
            
            // 过滤掉内部字段和保留字段
            const filteredData = { ...item };
            ['id', 'isLocal', 'isNew', 'isModified', 'isDeleted', 'syncFailed', 'createdAt', 'updatedAt'].forEach(key => {
                delete filteredData[key];
            });
            
            Object.keys(filteredData).forEach(key => {
                table.set(key, filteredData[key]);
            });
            
            await table.save();
            
            // 更新本地数据状态
            const index = this.data[type].findIndex(i => i.id === item.id);
            if (index !== -1) {
                this.data[type][index].isLocal = false;
                this.data[type][index].isModified = false;
                this.data[type][index].syncFailed = false;
                this.notifyDataUpdated(type, this.data[type]);
            }
            
            console.log(`Updated ${type} item in cloud successfully:`, item.id);
            return true;
        } catch (error) {
            console.error(`Failed to update ${type} item in cloud:`, error);
            // 标记为同步失败
            const index = this.data[type].findIndex(i => i.id === item.id);
            if (index !== -1) {
                this.data[type][index].syncFailed = true;
                this.notifyDataUpdated(type, this.data[type]);
            }
            throw error;
        }
    }
    
    async deleteItemFromCloud(type, item) {
        try {
            console.log(`Deleting ${type} item from cloud:`, item.id);
            
            // 确保AV对象存在
            if (typeof AV === 'undefined') {
                throw new Error('LeanCloud SDK未正确加载');
            }
            
            // 如果是临时ID，直接从本地删除
            if (item.id.startsWith('temp_')) {
                this.data[type] = this.data[type].filter(i => i.id !== item.id);
                this.notifyDataUpdated(type, this.data[type]);
                return true;
            }
            
            const Table = AV.Object.extend(type);
            const table = AV.Object.createWithoutData(Table, item.id);
            
            await table.destroy();
            
            // 从本地数据中删除
            this.data[type] = this.data[type].filter(i => i.id !== item.id);
            this.notifyDataUpdated(type, this.data[type]);
            
            console.log(`Deleted ${type} item from cloud successfully:`, item.id);
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
            
            // 确保AV对象存在
            if (typeof AV === 'undefined') {
                throw new Error('LeanCloud SDK未正确加载');
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
            this.showNotification(`文件上传失败：${error.message}`, 'error');
            return null;
        }
    }
    
    async uploadBase64(base64Data, fileName, mimeType = 'image/jpeg') {
        try {
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
    
    generateTempId() {
        // 生成符合格式的临时ID
        const chars = '0123456789abcdef';
        let id = 'temp_';
        for (let i = 0; i < 18; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }
    
    saveLocalBackup() {
        try {
            console.log('Saving local backup...');
            const backupData = {
                data: this.data,
                timestamp: new Date().toISOString()
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
                console.log('Local backup loaded successfully');
                this.showNotification('已加载本地备份数据', 'info');
                
                // 通知监听器数据已更新
                this.notifyDataUpdated();
                
                return true;
            }
            
            console.log('Invalid local backup data');
            return false;
        } catch (error) {
            console.error('Failed to load local backup:', error);
            return false;
        }
    }
    
    clearLocalBackup() {
        try {
            localStorage.removeItem('loveSiteBackup');
            console.log('Local backup cleared');
        } catch (error) {
            console.error('Failed to clear local backup:', error);
        }
    }
    
    startAutoSync() {
        // 每3分钟自动同步一次
        this.autoSyncInterval = setInterval(() => {
            if (this.isReady && this.syncStatus !== 'syncing') {
                console.log('Starting auto-sync...');
                this.syncAllData();
            }
        }, 3 * 60 * 1000);
    }
    
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }
    
    getData(type) {
        return this.data[type] || [];
    }
    
    getSyncStatus() {
        return {
            status: this.syncStatus,
            error: this.errorMessage,
            isReady: this.isReady
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
        
        // 如果页面中有通知函数，使用页面的通知
        if (window.showNotification) {
            try {
                window.showNotification(message, type);
            } catch (error) {
                console.error('Failed to call window.showNotification:', error);
            }
        }
    }
    
    // 添加监听器方法
    onDataUpdated(callback) {
        if (typeof callback === 'function') {
            this.updateListeners.push(callback);
            console.log('Data update listener added');
        }
    }
    
    // 通知所有监听器数据已更新
    notifyDataUpdated(type = null, data = null) {
        try {
            console.log(`Notifying ${this.updateListeners.length} listeners about data update`);
            this.updateListeners.forEach(callback => {
                try {
                    if (type && data) {
                        callback(type, data);
                    } else {
                        // 如果没有指定类型，通知所有数据类型的更新
                        Object.keys(this.data).forEach(dataType => {
                            callback(dataType, this.data[dataType]);
                        });
                    }
                } catch (error) {
                    console.error('Error in data update listener:', error);
                }
            });
        } catch (error) {
            console.error('Failed to notify data update listeners:', error);
        }
    }
}

// 全局初始化函数
window.initSimpleDataSync = function(config) {
    console.log('window.initSimpleDataSync called with config:', config);
    return new SimpleDataSync(config);
};

// 全局同步状态管理
window.syncStatus = {
    getStatus: function() {
        if (window.dataSync) {
            return window.dataSync.getSyncStatus();
        }
        return { status: 'not_initialized', isReady: false };
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
        
        switch (status.status) {
            case 'ready':
                message = '数据同步服务正常运行';
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
        
        console.log(`[SYNC STATUS] ${message}`);
        
        if (window.showNotification) {
            window.showNotification(message, type);
        }
        
        return { message, type };
    }
};

console.log('LeanCloud proxy script loaded and ready');