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
            
            return results.map(result => ({
                id: result.id,
                ...result.toJSON()
            }));
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
            table.set('createdAt', new Date());
            table.set('updatedAt', new Date());
            
            const result = await table.save();
            
            this.showNotification(`${this.getTableNameCN(tableName)}添加成功！`, 'success');
            return {
                id: result.id,
                ...result.toJSON()
            };
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
            table.set('updatedAt', new Date());
            
            const result = await table.save();
            
            this.showNotification(`${this.getTableNameCN(tableName)}更新成功！`, 'success');
            return {
                id: result.id,
                ...result.toJSON()
            };
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
            
            const Table = AV.Object.extend(tableName);
            const table = AV.Object.createWithoutData(Table, id);
            
            await table.destroy();
            
            this.showNotification(`${this.getTableNameCN(tableName)}删除成功！`, 'success');
            return true;
        } catch (error) {
            console.error(`Failed to delete ${tableName} data:`, error);
            this.showNotification(`${this.getTableNameCN(tableName)}删除失败！`, 'error');
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
            
            this.showNotification('文件上传成功！', 'success');
            return {
                url: result.url(),
                name: result.name(),
                size: result.size()
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
            
            // 将base64转换为Blob
            const byteString = atob(base64Data.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            
            const blob = new Blob([ab], { type: mimeType });
            const file = new File([blob], fileName, { type: mimeType });
            
            return this.uploadFile(file, fileName);
        } catch (error) {
            console.error('Failed to upload base64 file:', error);
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
            
            // 监听数据变化
            query.subscribe().then(subscription => {
                subscription.on('create', object => {
                    callback('create', { id: object.id, ...object.toJSON() });
                });
                
                subscription.on('update', object => {
                    callback('update', { id: object.id, ...object.toJSON() });
                });
                
                subscription.on('delete', object => {
                    callback('delete', { id: object.id });
                });
                
                console.log(`Realtime listener setup for ${tableName}`);
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
    }

    async init() {
        // 初始化本地数据
        this.dataTypes.forEach(type => {
            this.localData[type] = this.loadLocalData(type);
        });

        // 等待LeanCloud初始化完成
        await new Promise(resolve => {
            const check = () => {
                if (window.AV && AV.applicationId) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });

        // 加载远程数据
        await this.syncAllData();

        // 设置实时监听
        this.setupRealtimeListeners();

        // 启动自动同步
        this.startAutoSync();

        console.log('LoveSiteDataSync initialized successfully');
    }

    async syncAllData() {
        try {
            const promises = this.dataTypes.map(type => this.syncDataType(type));
            await Promise.all(promises);
            this.notifySyncComplete();
            return true;
        } catch (error) {
            console.error('Failed to sync all data:', error);
            return false;
        }
    }

    async syncDataType(type) {
        try {
            // 从远程获取数据
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
        if (!local || local.length === 0) return remote;
        if (!remote || remote.length === 0) return local;

        const localMap = new Map(local.map(item => [item.id || item.timestamp, item]));
        const remoteMap = new Map(remote.map(item => [item.id || item.timestamp, item]));

        // 合并数据，远程数据优先
        const mergedMap = new Map([...localMap, ...remoteMap]);
        
        // 转换回数组并排序
        const mergedArray = Array.from(mergedMap.values());
        
        // 根据类型进行排序
        if (type === 'Message' || type === 'Diary') {
            mergedArray.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
        } else if (type === 'Photo') {
            mergedArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }

        return mergedArray;
    }

    async addItem(type, data) {
        try {
            // 添加到本地
            const newItem = {
                ...data,
                timestamp: new Date().toISOString(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 添加到远程
            const remoteItem = await this.proxy.addData(type, newItem);
            
            if (remoteItem) {
                // 更新本地数据
                this.localData[type] = [remoteItem, ...this.localData[type].filter(item => 
                    !(item.id && remoteItem.id && item.id === remoteItem.id)
                )];
                this.saveLocalData(type, this.localData[type]);
                
                // 通知更新
                this.notifyDataUpdated(type, this.localData[type]);
                return remoteItem;
            } else {
                // 如果远程添加失败，至少保存到本地
                this.localData[type] = [newItem, ...this.localData[type]];
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
                return newItem;
            }
        } catch (error) {
            console.error(`Failed to add ${type} item:`, error);
            return null;
        }
    }

    async updateItem(type, id, data) {
        try {
            const updatedData = {
                ...data,
                updatedAt: new Date()
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
            return null;
        }
    }

    async deleteItem(type, id) {
        try {
            // 删除远程
            const success = await this.proxy.deleteData(type, id);
            
            if (success) {
                // 删除本地
                this.localData[type] = this.localData[type].filter(item => item.id !== id);
                this.saveLocalData(type, this.localData[type]);
                this.notifyDataUpdated(type, this.localData[type]);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Failed to delete ${type} item:`, error);
            return false;
        }
    }

    async uploadFile(file, fileName = null) {
        return this.proxy.uploadFile(file, fileName);
    }

    async uploadBase64(base64Data, fileName, mimeType = 'image/jpeg') {
        return this.proxy.uploadBase64(base64Data, fileName, mimeType);
    }

    setupRealtimeListeners() {
        this.dataTypes.forEach(type => {
            this.proxy.setupRealtimeListener(type, (action, data) => {
                console.log(`Real-time update for ${type}:`, action, data);
                
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
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Failed to load local ${type} data:`, error);
            return [];
        }
    }

    saveLocalData(type, data) {
        try {
            localStorage.setItem(`loveSite${type}`, JSON.stringify(data));
        } catch (error) {
            console.error(`Failed to save local ${type} data:`, error);
        }
    }

    startAutoSync() {
        // 每5分钟自动同步一次
        this.autoSyncInterval = setInterval(() => {
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
        this.syncListeners.forEach(callback => {
            callback(type, data);
        });
    }

    notifySyncComplete() {
        if (window.showNotification) {
            window.showNotification('所有数据同步完成！', 'success');
        }
    }

    getData(type) {
        return this.localData[type] || [];
    }
}