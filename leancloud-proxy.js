// leancloud-proxy.js - LeanCloud数据代理服务
class LeanCloudProxy {
    constructor(config) {
        this.appId = config.appId;
        this.appKey = config.appKey;
        this.serverURL = config.serverURL || 'https://leancloud.cn';
        this.init();
    }
    
    init() {
        // 动态加载LeanCloud SDK
        if (!window.AV) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/leancloud-storage@4.12.0/dist/av-min.js';
            script.onload = () => {
                this.initializeSDK();
            };
            script.onerror = (error) => {
                console.error('Failed to load LeanCloud SDK:', error);
                this.showNotification('LeanCloud SDK加载失败，请检查网络连接！', 'error');
            };
            document.head.appendChild(script);
        } else {
            this.initializeSDK();
        }
    }
    
    initializeSDK() {
        try {
            AV.init({
                appId: this.appId,
                appKey: this.appKey,
                serverURL: this.serverURL
            });
            console.log('LeanCloud SDK initialized successfully');
            this.showNotification('LeanCloud连接成功！', 'success');
        } catch (error) {
            console.error('LeanCloud initialization failed:', error);
            this.showNotification('LeanCloud初始化失败！', 'error');
        }
    }
    
    async getTableData(tableName) {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
            }

            const Table = AV.Object.extend(tableName);
            const query = new AV.Query(Table);
            query.descending('createdAt');
            
            const results = await query.find();
            const data = results.map(result => ({
                id: result.id,
                ...result.toJSON()
            }));
            
            console.log(`Fetched ${tableName} data:`, data);
            return data;
        } catch (error) {
            console.error(`Failed to get ${tableName} data:`, error);
            this.showNotification(`获取${this.getTableNameCN(tableName)}失败！`, 'error');
            return [];
        }
    }
    
    async addData(tableName, data) {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
            }

            const Table = AV.Object.extend(tableName);
            const table = new Table();

            // 设置数据
            Object.keys(data).forEach(key => {
                table.set(key, data[key]);
            });
            
            // 添加时间戳
            const now = new Date();
            table.set('createdAt', now);
            table.set('updatedAt', now);
            table.set('timestamp', now.toISOString());

            const result = await table.save();
            const savedData = {
                id: result.id,
                ...result.toJSON()
            };
            
            console.log(`Added ${tableName} item:`, savedData);
            this.showNotification(`${this.getTableNameCN(tableName)}添加成功！`, 'success');
            return savedData;
        } catch (error) {
            console.error(`Failed to add ${tableName} data:`, error);
            this.showNotification(`${this.getTableNameCN(tableName)}添加失败！`, 'error');
            return null;
        }
    }
    
    async updateData(tableName, id, data) {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
            }

            const Table = AV.Object.extend(tableName);
            const table = AV.Object.createWithoutData(Table, id);

            // 更新数据
            Object.keys(data).forEach(key => {
                table.set(key, data[key]);
            });
            
            // 更新时间戳
            const now = new Date();
            table.set('updatedAt', now);
            table.set('timestamp', now.toISOString());

            const result = await table.save();
            const updatedData = {
                id: result.id,
                ...result.toJSON()
            };
            
            console.log(`Updated ${tableName} item:`, updatedData);
            this.showNotification(`${this.getTableNameCN(tableName)}更新成功！`, 'success');
            return updatedData;
        } catch (error) {
            console.error(`Failed to update ${tableName} data:`, error);
            this.showNotification(`${this.getTableNameCN(tableName)}更新失败！`, 'error');
            return null;
        }
    }
    
    async deleteData(tableName, id) {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
            }

            console.log(`Attempting to delete ${tableName} item with id:`, id);
            
            // 先验证ID格式
            if (!id || typeof id !== 'string' || id.length !== 24) {
                throw new Error(`Invalid objectId format: ${id}. ObjectId must be a 24-character string.`);
            }

            const Table = AV.Object.extend(tableName);
            const table = AV.Object.createWithoutData(Table, id);

            // 先尝试获取对象确认存在
            try {
                await table.fetch({ include: [] });
                console.log(`${tableName} item exists, proceeding with deletion`);
            } catch (fetchError) {
                if (fetchError.code === 101) {
                    console.warn(`${tableName} item not found, skipping deletion`);
                    this.showNotification(`${this.getTableNameCN(tableName)}不存在或已删除！`, 'warning');
                    return true; // 虽然没找到，但也算是"删除成功"了
                }
                throw fetchError;
            }

            await table.destroy();

            console.log(`Deleted ${tableName} item with id:`, id);
            this.showNotification(`${this.getTableNameCN(tableName)}删除成功！`, 'success');
            return true;
        } catch (error) {
            console.error(`Failed to delete ${tableName} data:`, error);
            let errorMessage = `${this.getTableNameCN(tableName)}删除失败！`;
            
            // 根据错误类型提供更具体的信息
            if (error.code === 101) {
                errorMessage = `${this.getTableNameCN(tableName)}不存在！`;
            } else if (error.code === 403) {
                errorMessage = `${this.getTableNameCN(tableName)}删除权限不足！`;
            } else if (error.message && error.message.includes('Invalid objectId')) {
                errorMessage = `ID格式错误，请检查ID是否正确！`;
            }
            
            this.showNotification(errorMessage, 'error');
            return false;
        }
    }
    
    async uploadFile(file, fileName = null) {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
            }

            const name = fileName || file.name;
            const avFile = new AV.File(name, file);

            const result = await avFile.save();
            
            console.log(`Uploaded file:`, result);
            return {
                url: result.url(),
                name: result.name(),
                size: result.size(),
                id: result.id
            };
        } catch (error) {
            console.error('Failed to upload file:', error);
            this.showNotification('文件上传失败！', 'error');
            return null;
        }
    }
    
    async uploadBase64(base64Data, fileName, mimeType = 'image/jpeg') {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
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
    
    setupRealtimeListener(tableName, callback) {
        try {
            if (!window.AV) {
                throw new Error('LeanCloud SDK not loaded');
            }

            const Table = AV.Object.extend(tableName);
            const query = new AV.Query(Table);
            
            query.subscribe().then(subscription => {
                subscription.on('create', (object) => {
                    callback('create', { id: object.id, ...object.toJSON() });
                });
                
                subscription.on('update', (object) => {
                    callback('update', { id: object.id, ...object.toJSON() });
                });
                
                subscription.on('delete', (object) => {
                    callback('delete', { id: object.id });
                });
            });
        } catch (error) {
            console.error(`Failed to setup realtime listener for ${tableName}:`, error);
        }
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
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }
}

// 全局数据同步管理器
class LoveSiteDataSync {
    constructor(config) {
        this.proxy = new LeanCloudProxy(config);
        this.dataTypes = ['Photo', 'Diary', 'Message', 'Anniversary', 'Setting'];
        this.localData = {};
        this.syncListeners = [];
        this.isInitialized = false;
    }
    
    async init() {
        try {
            // 初始化本地数据
            this.dataTypes.forEach(type => {
                this.localData[type] = this.loadLocalData(type);
                console.log(`Loaded local ${type} data:`, this.localData[type].length, 'items');
            });
            
            // 等待LeanCloud初始化完成
            await new Promise((resolve, reject) => {
                const check = () => {
                    if (window.AV && AV.applicationId) {
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                };
                
                // 设置超时
                const timeout = setTimeout(() => {
                    reject(new Error('LeanCloud SDK initialization timeout'));
                }, 10000);
                
                check();
            });
            
            // 加载远程数据
            await this.syncAllData();
            
            // 设置实时监听
            this.setupRealtimeListeners();
            
            // 启动自动同步
            this.startAutoSync();
            
            this.isInitialized = true;
            console.log('LoveSiteDataSync initialized successfully');
            this.showNotification('数据同步服务初始化成功！', 'success');
        } catch (error) {
            console.error('LoveSiteDataSync initialization failed:', error);
            this.showNotification('数据同步服务初始化失败！', 'error');
        }
    }
    
    async syncAllData() {
        try {
            if (!this.isInitialized) {
                console.warn('Data sync skipped: not initialized');
                return false;
            }
            
            console.log('Starting full data sync...');
            const promises = this.dataTypes.map(type => this.syncDataType(type));
            await Promise.all(promises);
            console.log('Full data sync completed');
            this.notifySyncComplete();
            return true;
        } catch (error) {
            console.error('Failed to sync all data:', error);
            return false;
        }
    }
    
    async syncDataType(type) {
        try {
            if (!this.isInitialized) {
                console.warn(`Sync ${type} skipped: not initialized`);
                return this.localData[type] || [];
            }
            
            console.log(`Syncing ${type} data...`);
            const remoteData = await this.proxy.getTableData(type);
            
            // 合并本地和远程数据
            const mergedData = this.mergeData(type, this.localData[type], remoteData);

            // 更新本地数据
            this.localData[type] = mergedData;
            this.saveLocalData(type, mergedData);

            // 通知数据更新
            this.notifyDataUpdated(type, mergedData);

            console.log(`Synced ${type} data: ${mergedData.length} items`);
            return mergedData;
        } catch (error) {
            console.error(`Failed to sync ${type} data:`, error);
            return this.localData[type] || [];
        }
    }
    
    mergeData(type, local, remote) {
        if (!local || local.length === 0) return remote || [];
        if (!remote || remote.length === 0) return local || [];
        
        console.log(`Merging ${type} data: local=${local.length}, remote=${remote.length}`);
        
        const localMap = new Map();
        local.forEach(item => {
            const key = item.id || item.timestamp;
            if (key) {
                localMap.set(key, item);
            }
        });
        
        const remoteMap = new Map();
        remote.forEach(item => {
            const key = item.id || item.timestamp;
            if (key) {
                remoteMap.set(key, item);
            }
        });
        
        // 合并数据，远程数据优先
        const mergedMap = new Map([...localMap, ...remoteMap]);
        const mergedArray = Array.from(mergedMap.values());
        
        // 按时间排序
        mergedArray.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA; // 倒序排列
        });
        
        console.log(`Merged ${type} data: ${mergedArray.length} items`);
        return mergedArray;
    }
    
    getData(type) {
        return this.localData[type] || [];
    }
    
    async addItem(type, data) {
        try {
            if (!this.isInitialized) {
                this.showNotification('数据同步服务未初始化！', 'error');
                return null;
            }
            
            if (!this.dataTypes.includes(type)) {
                this.showNotification('无效的数据类型！', 'error');
                return null;
            }
            
            console.log(`Adding ${type} item:`, data);
            
            // 添加远程
            const remoteItem = await this.proxy.addData(type, data);
            
            if (remoteItem) {
                // 更新本地数据
                this.localData[type] = [remoteItem, ...this.localData[type]];
                this.saveLocalData(type, this.localData[type]);

                // 通知更新
                this.notifyDataUpdated(type, this.localData[type]);
                return remoteItem;
            } else {
                // 如果远程添加失败，至少保存到本地
                const newItem = {
                    ...data,
                    id: 'local_' + Date.now(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    timestamp: new Date().toISOString(),
                    isLocal: true
                };
                
                this.localData[type] = [newItem, ...this.localData[type]];
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
                
                this.showNotification(`${this.getTableNameCN(type)}已保存到本地，稍后会自动同步到云端！`, 'warning');
                return newItem;
            }
        } catch (error) {
            console.error(`Failed to add ${type} item:`, error);
            this.showNotification(`${this.getTableNameCN(type)}添加失败！`, 'error');
            return null;
        }
    }
    
    async updateItem(type, id, data) {
        try {
            if (!this.isInitialized) {
                this.showNotification('数据同步服务未初始化！', 'error');
                return null;
            }
            
            if (!this.dataTypes.includes(type)) {
                this.showNotification('无效的数据类型！', 'error');
                return null;
            }
            
            console.log(`Updating ${type} item ${id}:`, data);
            
            const updatedData = {
                ...data,
                updatedAt: new Date(),
                timestamp: new Date().toISOString()
            };
            
            // 更新远程
            const remoteItem = await this.proxy.updateData(type, id, updatedData);

            if (remoteItem) {
                // 更新本地
                this.localData[type] = this.localData[type].map(item =>
                    item.id === id ? remoteItem : item
                );
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
                return remoteItem;
            }
            
            return null;
        } catch (error) {
            console.error(`Failed to update ${type} item:`, error);
            this.showNotification(`${this.getTableNameCN(type)}更新失败！`, 'error');
            return null;
        }
    }
    
    async deleteItem(type, id) {
        try {
            if (!this.isInitialized) {
                this.showNotification('数据同步服务未初始化！', 'error');
                return false;
            }
            
            if (!this.dataTypes.includes(type)) {
                this.showNotification('无效的数据类型！', 'error');
                return false;
            }
            
            console.log(`Deleting ${type} item with id:`, id);
            
            // 验证ID是否存在于本地数据中
            const itemExists = this.localData[type].some(item => item.id === id);
            if (!itemExists) {
                console.warn(`${type} item ${id} not found in local data`);
                this.showNotification(`${this.getTableNameCN(type)}不存在！`, 'error');
                return false;
            }
            
            // 删除远程
            const success = await this.proxy.deleteData(type, id);

            if (success) {
                // 删除本地
                const beforeDeleteCount = this.localData[type].length;
                this.localData[type] = this.localData[type].filter(item => item.id !== id);
                const afterDeleteCount = this.localData[type].length;
                
                console.log(`${type} item ${id} deleted: ${beforeDeleteCount} -> ${afterDeleteCount} items`);
                
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
                
                // 额外的成功通知
                this.showNotification(`${this.getTableNameCN(type)}删除成功！`, 'success');
                return true;
            } else {
                console.warn(`Remote deletion of ${type} item ${id} failed`);
                return false;
            }
        } catch (error) {
            console.error(`Failed to delete ${type} item:`, error);
            this.showNotification(`${this.getTableNameCN(type)}删除失败！`, 'error');
            return false;
        }
    }
    
    async uploadFile(file, fileName = null) {
        try {
            if (!this.isInitialized) {
                this.showNotification('数据同步服务未初始化！', 'error');
                return null;
            }
            
            return this.proxy.uploadFile(file, fileName);
        } catch (error) {
            console.error('Failed to upload file:', error);
            this.showNotification('文件上传失败！', 'error');
            return null;
        }
    }
    
    async uploadBase64(base64Data, fileName, mimeType = 'image/jpeg') {
        try {
            if (!this.isInitialized) {
                this.showNotification('数据同步服务未初始化！', 'error');
                return null;
            }
            
            return this.proxy.uploadBase64(base64Data, fileName, mimeType);
        } catch (error) {
            console.error('Failed to upload base64 data:', error);
            this.showNotification('图片上传失败！', 'error');
            return null;
        }
    }
    
    setupRealtimeListeners() {
        this.dataTypes.forEach(type => {
            this.proxy.setupRealtimeListener(type, (action, data) => {
                console.log(`Realtime update for ${type}:`, action, data);
                
                switch (action) {
                    case 'create':
                        this.localData[type] = [data, ...this.localData[type]];
                        break;
                    case 'update':
                        this.localData[type] = this.localData[type].map(item =>
                            item.id === data.id ? data : item
                        );
                        break;
                    case 'delete':
                        this.localData[type] = this.localData[type].filter(item => item.id !== data.id);
                        break;
                }

                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
            });
        });
    }
    
    loadLocalData(type) {
        try {
            const data = localStorage.getItem(`loveSite${type}`);
            const parsedData = data ? JSON.parse(data) : [];
            console.log(`Loaded local ${type} data:`, parsedData.length, 'items');
            return parsedData;
        } catch (error) {
            console.error(`Failed to load local ${type} data:`, error);
            return [];
        }
    }
    
    saveLocalData(type, data) {
        try {
            console.log(`Saving local ${type} data:`, data.length, 'items');
            localStorage.setItem(`loveSite${type}`, JSON.stringify(data));
        } catch (error) {
            console.error(`Failed to save local ${type} data:`, error);
        }
    }
    
    startAutoSync() {
        // 每5分钟自动同步一次
        this.autoSyncInterval = setInterval(() => {
            console.log('Starting auto-sync...');
            this.syncAllData();
        }, 5 * 60 * 1000);
    }
    
    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    }
    
    onDataUpdated(callback) {
        this.syncListeners.push(callback);
    }
    
    notifyDataUpdated(type, data) {
        console.log(`Notifying data update for ${type}:`, data.length, 'items');
        this.syncListeners.forEach(callback => callback(type, data));
    }
    
    notifySyncComplete() {
        this.showNotification('所有数据同步完成！', 'success');
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
        if (window.showNotification) {
            window.showNotification(message, type);
        }
    }
}

// 全局初始化函数
window.initLoveSiteDataSync = function(config) {
    return new LoveSiteDataSync(config);
};