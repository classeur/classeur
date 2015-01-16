angular.module('classeur.core.files', [])
	.factory('clFileSvc', function(clUid) {

		var localFiles = JSON.parse(localStorage.fileIds || '[]').map(function(id) {
			return new LocalFile(id);
		});

		function sortLocalFiles() {
			localFiles.sort(function(fileDao1, fileDao2) {
				return fileDao1.updated - fileDao2.updated;
			});
		}
		sortLocalFiles();

		function LocalFile(id) {
			this.id = id;
			var isSaving, isLoaded, isUnloading;
			this.updated = parseInt(localStorage['file.' + this.id + '.updated'] || '0');
			this.title = localStorage['file.' + this.id + '.title'] || '';
			this.folderId = localStorage['file.' + this.id + '.folderId'] || '';

			this.load = function(cb) {
				if(!isLoaded || !isSaving) {
					this.content = localStorage['file.' + this.id + '.content'] || '';
					this.state = JSON.parse(localStorage['file.' + this.id + '.state'] || '{}');
					this.users = JSON.parse(localStorage['file.' + this.id + '.users'] || '{}');
					this.discussions = JSON.parse(localStorage['file.' + this.id + '.discussions'] || '{}');
				}
				isUnloading = false;
				isLoaded = true;
				this.save();
				cb();
			};

			var debouncedSave = window.cledit.Utils.debounce((function() {
				localStorage['file.' + this.id + '.title'] = this.title;
				localStorage['file.' + this.id + '.folderId'] = this.folderId;
				if(isLoaded) {
					this.updated = Date.now();
					localStorage['file.' + this.id + '.updated'] = this.updated;
					localStorage['file.' + this.id + '.content'] = this.content;
					localStorage['file.' + this.id + '.state'] = JSON.stringify(this.state);
					localStorage['file.' + this.id + '.users'] = JSON.stringify(this.users);
					localStorage['file.' + this.id + '.discussions'] = JSON.stringify(this.discussions);
					sortLocalFiles();
				}
				isSaving = false;
				if(isUnloading) {
					delete this.content;
					delete this.state;
					delete this.users;
					delete this.discussions;
					isUnloading = false;
					isLoaded = false;
				}
			}).bind(this), 100);

			this.save = function() {
				isSaving = true;
				debouncedSave();
			};

			this.unload = function() {
				isUnloading = true;
				this.save();
			};
		}

		function ReadOnlyFile(title, content) {
			this.content = content;
			this.state = {};
			this.title = title;
			this.save = function() {
				this.isSaveAttempted = true;
			};
		}

		function addLocalFile(fileDao) {
			localFiles.unshift(fileDao);
			var filesToRemove = localFiles.splice(1);
			localStorage.fileIds = JSON.stringify(localFiles.map(function(fileDao) {
				return fileDao.id;
			}));
			filesToRemove.forEach(function(fileToRemove) {
				var keyPrefix = '^file\\.' + fileToRemove.id + '\\.';
				for (var key in localStorage){
					if(key.match(keyPrefix)) {
						localStorage.removeItem(key);
					}
				}
			});
		}

		return {
			localFiles: localFiles,
			newLocalFile: function() {
				var fileDao = new LocalFile(clUid());
				addLocalFile(fileDao);
				return fileDao;
			},
			readOnlyFile: function(title, content) {
				return new ReadOnlyFile(title, content);
			}
		};
	});
