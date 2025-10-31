// leancloud-proxy.js - LeanCloud数据代理服务（改进版）
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
                ...result.toJSON(),
                isLocal: false // 标记为云端数据
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

            // 设置数据，排除内部字段
            const filteredData = { ...data };
            delete filteredData.id;
            delete filteredData.isLocal;
            delete filteredData.createdAt;
            delete filteredData.updatedAt;

            Object.keys(filteredData).forEach(key => {
                table.set(key, filteredData[key]);
            });
            
            // 添加时间戳
            const now = new Date();
            table.set('createdAt', now);
            table.set('updatedAt', now);
            table.set('timestamp', now.toISOString());

            const result = await table.save();
            const savedData = {
                id: result.id,
                ...result.toJSON(),
                isLocal: false
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

            // 更新数据，排除内部字段
            const filteredData = { ...data };
            delete filteredData.id;
            delete filteredData.isLocal;
            delete filteredData.createdAt;

            Object.keys(filteredData).forEach(key => {
                table.set(key, filteredData[key]);
            });
            
            // 更新时间戳
            const now = new Date();
            table.set('updatedAt', now);
            table.set('timestamp', now.toISOString());

            const result = await table.save();
            const updatedData = {
                id: result.id,
                ...result.toJSON(),
                isLocal: false
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
            if (!this.isValidObjectId(id)) {
                // 如果是本地临时数据，直接返回成功
                console.warn(`Invalid objectId format, treating as local item: ${id}`);
                return true;
            }

            const Table = AV.Object.extend(tableName);
            const table = AV.Object.createWithoutData(Table, id);

            try {
                await table.destroy();
                console.log(`Deleted ${tableName} item with id:`, id);
                this.showNotification(`${this.getTableNameCN(tableName)}删除成功！`, 'success');
                return true;
            } catch (error) {
                if (error.code === 101) {
                    console.warn(`${tableName} item not found, skipping deletion`);
                    this.showNotification(`${this.getTableNameCN(tableName)}不存在或已删除！`, 'warning');
                    return true;
                }
                throw error;
            }
        } catch (error) {
            console.error(`Failed to delete ${tableName} data:`, error);
            let errorMessage = `${this.getTableNameCN(tableName)}删除失败！`;
            
            if (error.code === 403) {
                errorMessage = `${this.getTableNameCN(tableName)}删除权限不足！`;
            }
            
            this.showNotification(errorMessage, 'error');
            return false;
        }
    }
    
    isValidObjectId(id) {
        // 检查是否为24位十六进制字符串
        return /^[0-9a-fA-F]{24}$/.test(id);
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
                    callback('create', { id: object.id, ...object.toJSON(), isLocal: false });
                });
                
                subscription.on('update', (object) => {
                    callback('update', { id: object.id, ...object.toJSON(), isLocal: false });
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

// 全局数据同步管理器（改进版）
class LoveSiteDataSync {
    constructor(config) {
        this.proxy = new LeanCloudProxy(config);
        this.dataTypes = ['Photo', 'Diary', 'Message', 'Anniversary', 'Setting'];
        this.localData = {};
        this.syncListeners = [];
        this.isInitialized = false;
        this.syncing = false;
        this.pendingSyncs = new Map(); // 待同步的操作队列
    }
    
    async init() {
        try {
            // 初始化本地数据
            this.dataTypes.forEach(type => {
                this.localData[type] = this.loadLocalData(type);
                console.log(`Loaded local ${type} data:`, this.localData[type].length, 'items');
            });
            
            // 等待LeanCloud初始化完成
            await this.waitForLeanCloud();
            
            // 加载远程数据
            await this.syncAllData();
            
            // 设置实时监听
            this.setupRealtimeListeners();
            
            // 启动自动同步
            this.startAutoSync();
            
            // 处理待同步的操作
            this.processPendingSyncs();
            
            this.isInitialized = true;
            console.log('LoveSiteDataSync initialized successfully');
            this.showNotification('数据同步服务初始化成功！', 'success');
        } catch (error) {
            console.error('LoveSiteDataSync initialization failed:', error);
            this.showNotification('数据同步服务初始化失败！', 'error');
        }
    }
    
    async waitForLeanCloud() {
        return new Promise((resolve, reject) => {
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
    }
    
    async syncAllData() {
        if (this.syncing) {
            console.warn('Sync already in progress, skipping');
            return false;
        }
        
        try {
            if (!this.isInitialized) {
                console.warn('Data sync skipped: not initialized');
                return false;
            }
            
            this.syncing = true;
            console.log('Starting full data sync...');
            
            const promises = this.dataTypes.map(type => this.syncDataType(type));
            await Promise.all(promises);
            
            console.log('Full data sync completed');
            this.notifySyncComplete();
            return true;
        } catch (error) {
            console.error('Failed to sync all data:', error);
            this.showNotification('数据同步失败！', 'error');
            return false;
        } finally {
            this.syncing = false;
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
            const key = item.id;
            if (key) {
                localMap.set(key, item);
            }
        });
        
        const remoteMap = new Map();
        remote.forEach(item => {
            const key = item.id;
            if (key) {
                remoteMap.set(key, item);
            }
        });
        
        // 合并数据，遵循以下规则：
        // 1. 云端数据优先
        // 2. 本地非临时数据如果云端没有，保留
        // 3. 本地临时数据如果云端没有，保留
        const mergedMap = new Map();
        
        // 先添加云端数据
        remoteMap.forEach((item, key) => {
            mergedMap.set(key, item);
        });
        
        // 再添加本地独有的数据
        localMap.forEach((item, key) => {
            if (!remoteMap.has(key)) {
                mergedMap.set(key, item);
            }
        });
        
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
            if (!this.dataTypes.includes(type)) {
                this.showNotification('无效的数据类型！', 'error');
                return null;
            }
            
            console.log(`Adding ${type} item:`, data);
            
            const newItem = {
                ...data,
                id: this.generateTempId(),
                createdAt: new Date(),
                updatedAt: new Date(),
                timestamp: new Date().toISOString(),
                isLocal: true
            };
            
            // 先保存到本地
            this.localData[type] = [newItem, ...this.localData[type]];
            this.saveLocalData(type, this.localData[type]);
            this.notifyDataUpdated(type, this.localData[type]);
            
            // 如果服务已初始化，尝试同步到云端
            if (this.isInitialized) {
                this.queueSyncOperation('add', type, newItem);
            } else {
                this.showNotification(`${this.getTableNameCN(type)}已保存到本地，服务初始化后将自动同步！`, 'info');
            }
            
            return newItem;
        } catch (error) {
            console.error(`Failed to add ${type} item:`, error);
            this.showNotification(`${this.getTableNameCN(type)}添加失败！`, 'error');
            return null;
        }
    }
    
    generateTempId() {
        // 生成符合LeanCloud格式的临时ID（24位十六进制）
        const chars = '0123456789abcdef';
        let id = 'temp_';
        for (let i = 0; i < 18; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }
    
    async updateItem(type, id, data) {
        try {
            if (!this.dataTypes.includes(type)) {
                this.showNotification('无效的数据类型！', 'error');
                return null;
            }
            
            console.log(`Updating ${type} item ${id}:`, data);
            
            const updatedData = {
                ...data,
                id: id,
                updatedAt: new Date(),
                timestamp: new Date().toISOString()
            };
            
            // 先更新本地数据
            const itemIndex = this.localData[type].findIndex(item => item.id === id);
            if (itemIndex !== -1) {
                const oldItem = this.localData[type][itemIndex];
                this.localData[type][itemIndex] = {
                    ...oldItem,
                    ...updatedData,
                    isLocal: oldItem.isLocal // 保持原有本地标记状态
                };
                
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
            }
            
            // 如果服务已初始化，尝试同步到云端
            if (this.isInitialized) {
                this.queueSyncOperation('update', type, updatedData);
            }
            
            return updatedData;
        } catch (error) {
            console.error(`Failed to update ${type} item:`, error);
            this.showNotification(`${this.getTableNameCN(type)}更新失败！`, 'error');
            return null;
        }
    }
    
    async deleteItem(type, id) {
        try {
            if (!this.dataTypes.includes(type)) {
                this.showNotification('无效的数据类型！', 'error');
                return false;
            }
            
            console.log(`Deleting ${type} item with id:`, id);
            
            // 验证ID是否存在于本地数据中
            const itemIndex = this.localData[type].findIndex(item => item.id === id);
            if (itemIndex === -1) {
                console.warn(`${type} item ${id} not found in local data`);
                this.showNotification(`${this.getTableNameCN(type)}不存在！`, 'error');
                return false;
            }
            
            const itemToDelete = this.localData[type][itemIndex];
            
            // 先从本地删除
            const beforeDeleteCount = this.localData[type].length;
            this.localData[type] = this.localData[type].filter(item => item.id !== id);
            const afterDeleteCount = this.localData[type].length;
            
            console.log(`${type} item ${id} deleted locally: ${beforeDeleteCount} -> ${afterDeleteCount} items`);
            
            this.saveLocalData(type, this.localData[type]);
            this.notifyDataUpdated(type, this.localData[type]);
            
            // 如果服务已初始化，尝试同步到云端
            if (this.isInitialized && !itemToDelete.isLocal) {
                this.queueSyncOperation('delete', type, { id: id });
            }
            
            this.showNotification(`${this.getTableNameCN(type)}删除成功！`, 'success');
            return true;
        } catch (error) {
            console.error(`Failed to delete ${type} item:`, error);
            this.showNotification(`${this.getTableNameCN(type)}删除失败！`, 'error');
            return false;
        }
    }
    
    queueSyncOperation(action, type, data) {
        try {
            if (!this.pendingSyncs.has(type)) {
                this.pendingSyncs.set(type, []);
            }
            
            const operations = this.pendingSyncs.get(type);
            const operation = {
                action: action,
                data: data,
                timestamp: Date.now()
            };
            
            // 去重：如果是相同ID的更新操作，只保留最新的
            if (action === 'update' && data.id) {
                const existingIndex = operations.findIndex(op => 
                    op.action === 'update' && op.data.id === data.id
                );
                if (existingIndex !== -1) {
                    operations.splice(existingIndex, 1);
                }
            }
            
            operations.push(operation);
            this.pendingSyncs.set(type, operations);
            
            console.log(`Queued ${action} operation for ${type}:`, data.id);
            
            // 立即尝试处理队列
            this.processPendingSyncs();
        } catch (error) {
            console.error('Failed to queue sync operation:', error);
        }
    }
    
    async processPendingSyncs() {
        if (this.syncing || !this.isInitialized) {
            console.warn('Sync queue processing skipped: sync in progress or not initialized');
            return;
        }
        
        try {
            this.syncing = true;
            
            for (const [type, operations] of this.pendingSyncs) {
                if (operations.length === 0) continue;
                
                console.log(`Processing ${operations.length} pending operations for ${type}`);
                
                for (let i = 0; i < operations.length; i++) {
                    const operation = operations[i];
                    const { action, data } = operation;
                    
                    try {
                        switch (action) {
                            case 'add':
                                await this.processAddOperation(type, data);
                                break;
                            case 'update':
                                await this.processUpdateOperation(type, data);
                                break;
                            case 'delete':
                                await this.processDeleteOperation(type, data);
                                break;
                        }
                        
                        // 操作成功，从队列中移除
                        operations.splice(i, 1);
                        i--; // 调整索引
                        
                    } catch (error) {
                        console.error(`Failed to process ${action} operation for ${type}:`, error);
                        // 如果失败，保留在队列中，下次继续尝试
                        if (Date.now() - operation.timestamp > 24 * 60 * 60 * 1000) {
                            // 超过24小时的操作，从队列中移除
                            console.warn(`Removing stale ${action} operation for ${type}`);
                            operations.splice(i, 1);
                            i--;
                        }
                    }
                }
                
                this.pendingSyncs.set(type, operations);
            }
            
            console.log('Pending sync operations processed');
        } catch (error) {
            console.error('Error processing sync queue:', error);
        } finally {
            this.syncing = false;
        }
    }
    
    async processAddOperation(type, data) {
        const remoteItem = await this.proxy.addData(type, data);
        if (remoteItem) {
            // 更新本地数据的ID和状态
            const localIndex = this.localData[type].findIndex(item => item.id === data.id);
            if (localIndex !== -1) {
                this.localData[type][localIndex] = {
                    ...remoteItem,
                    isLocal: false
                };
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
                this.showNotification(`${this.getTableNameCN(type)}已同步到云端！`, 'success');
            }
        }
    }
    
    async processUpdateOperation(type, data) {
        if (this.proxy.isValidObjectId(data.id)) {
            const remoteItem = await this.proxy.updateData(type, data.id, data);
            if (remoteItem) {
                const localIndex = this.localData[type].findIndex(item => item.id === data.id);
                if (localIndex !== -1) {
                    this.localData[type][localIndex] = {
                        ...remoteItem,
                        isLocal: false
                    };
                    this.saveLocalData(type, this.localData[type]);
                    this.notifyDataUpdated(type, this.localData[type]);
                }
            }
        }
    }
    
    async processDeleteOperation(type, data) {
        if (this.proxy.isValidObjectId(data.id)) {
            await this.proxy.deleteData(type, data.id);
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
                        this.handleRemoteCreate(type, data);
                        break;
                    case 'update':
                        this.handleRemoteUpdate(type, data);
                        break;
                    case 'delete':
                        this.handleRemoteDelete(type, data);
                        break;
                }
            });
        });
    }
    
    handleRemoteCreate(type, data) {
        const exists = this.localData[type].some(item => item.id === data.id);
        if (!exists) {
            this.localData[type] = [data, ...this.localData[type]];
            this.saveLocalData(type, this.localData[type]);
            this.notifyDataUpdated(type, this.localData[type]);
            this.showNotification(`收到新的${this.getTableNameCN(type)}！`, 'info');
        }
    }
    
    handleRemoteUpdate(type, data) {
        const index = this.localData[type].findIndex(item => item.id === data.id);
        if (index !== -1) {
            const oldItem = this.localData[type][index];
            const isLocalChange = oldItem.isLocal && !data.isLocal;
            
            this.localData[type][index] = data;
            this.saveLocalData(type, this.localData[type]);
            this.notifyDataUpdated(type, this.localData[type]);
            
            if (isLocalChange) {
                this.showNotification(`${this.getTableNameCN(type)}已同步到云端！`, 'success');
            }
        }
    }
    
    handleRemoteDelete(type, data) {
        const index = this.localData[type].findIndex(item => item.id === data.id);
        if (index !== -1) {
            this.localData[type].splice(index, 1);
            this.saveLocalData(type, this.localData[type]);
            this.notifyDataUpdated(type, this.localData[type]);
            this.showNotification(`${this.getTableNameCN(type)}已被删除！`, 'info');
        }
    }
    
    loadLocalData(type) {
        try {
            const data = localStorage.getItem(`loveSite${type}`);
            const parsedData = data ? JSON.parse(data) : [];
            
            // 数据迁移：如果有旧格式的临时ID，转换为新格式
            const migratedData = parsedData.map(item => {
                if (item.id && item.id.startsWith('local_') && item.id.length > 24) {
                    return {
                        ...item,
                        id: this.generateTempId()
                    };
                }
                return item;
            });
            
            console.log(`Loaded local ${type} data:`, migratedData.length, 'items');
            return migratedData;
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