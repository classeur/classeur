angular.module('classeur.core.sync', [])
	.run(function($rootScope, $http, $location, clUserSvc, clFolderSvc, clSocketSvc) {
		var lastActivity = 0;
		var maxInactivity = 10 * 1000; // 10 sec

		function updateLastActivity() {
			lastActivity = Date.now();
		}

		var folderSyncData = {};

		function syncFolders() {
			updateLastActivity();
			getFolderChangesPage(folderLastSeq);
		}

		function getFolderChangesPage(lastSeq) {
			clSocketSvc.sendMsg({
				type: 'getFolderChanges',
				lastSeq: lastSeq
			});
		}

		var folderLastSeq = 0;
		clSocketSvc.addMsgHandler('folderChanges', function(msg) {
			updateLastActivity();
			var foldersToUpdate = [];
			msg.changes.forEach(function(change) {
				var folderDao = clFolderSvc.folderMap[change.id];
				var syncData = folderSyncData[change.id] || {};
				if (
					/*jshint -W018 */
					!change.removed === !folderDao ||
					/*jshint +W018 */
					(folderDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
				) {
					foldersToUpdate.push(change);
				}
				folderSyncData[change.id] = {
					r: change.updated
				};
				folderLastSeq = change.seq;
			});
			if (foldersToUpdate.length) {
				clFolderSvc.updateFolders(foldersToUpdate);
				$rootScope.$apply();
			}
			if (msg.lastSeq) {
				folderLastSeq = msg.lastSeq;
				return getFolderChangesPage(folderLastSeq);
			}
			sendFolderChanges();
		});

		function sendFolderChanges() {
			var msg = {
				type: 'setFolderChanges',
				changes: []
			};
			clFolderSvc.folders.forEach(function(folderDao) {
				var syncData = folderSyncData[folderDao.id] || {};
				if (folderDao.updated == syncData.r) {
					return;
				}
				msg.changes.push({
					id: folderDao.id,
					name: folderDao.name,
					updated: folderDao.updated
				});
				syncData.s = folderDao.updated;
				folderSyncData[folderDao.id] = syncData;
			});
			// Check removed folders
			angular.forEach(folderSyncData, function(syncData, id) {
				if (!clFolderSvc.folderMap.hasOwnProperty(id)) {
					msg.changes.push({
						id: id,
						removed: true
					});
				}
			});
			msg.changes.length && clSocketSvc.sendMsg(msg);
		}

		function sync() {
			if (!clSocketSvc.isReady) {
				return;
			}
			if (Date.now() - lastActivity < maxInactivity) {
				return;
			}
			syncFolders();
		}
		$rootScope.$on('clPeriodicRun', sync);
	});
