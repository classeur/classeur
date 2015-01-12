angular.module('classeur.core.files', [])
	.factory('files', function(uid) {

		var localFiles = JSON.parse(localStorage.fileIds || '[]').map(function(id) {
			return new LocalFile(id);
		});

		function sortLocalFiles() {
			localFiles.sort(function(fileDao1, fileDao2) {
				return fileDao1.updated - fileDao2.updated;
			});
		}
		sortLocalFiles();

		function LocalFile(id, title) {
			this.id = id;
			var isSaving, isLoaded, isUnloading;
			this.updated = parseInt(localStorage['file.' + this.id + '.updated'] || '0');
			this.metadata = JSON.parse(localStorage['file.' + this.id + '.metadata'] || '{}');
			if(title) {
				this.metadata.title = title;
			}

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
				localStorage['file.' + this.id + '.metadata'] = JSON.stringify(this.metadata);
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
			this.metadata = {
				title: title
			};
			this.save = function() {
				this.isSaveAttempted = true;
			};
		}

		function addLocalFile(fileDao) {
			localFiles.unshift(fileDao);
			localFiles.splice(100);
			localStorage.fileIds = JSON.stringify(localFiles.map(function(fileDao) {
				return fileDao.id;
			}));
		}

		return {
			localFiles: localFiles,
			setCurrent: function(fileDao) {
				if(this.currentFileDao && this.currentFileDao.unload) {
					this.currentFileDao.unload();
				}
				this.currentFileDao = fileDao;
			},
			newLocalFile: function() {
				var fileDao = new LocalFile(uid(), 'Untitled');
				addLocalFile(fileDao);
				return fileDao;
			},
			readOnlyFile: function(title, content) {
				return new ReadOnlyFile(title, content);
			}
		};
	});
