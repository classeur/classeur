angular.module('classeur.services.btnBar', [])
	.factory('btnBar', function(cleditor, $famous) {
		var Transitionable = $famous['famous/transitions/Transitionable'];
		var btnBar = {};

		btnBar.btns = [
			{
				icon: 'mdi-editor-format-bold',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('bold');
				}
			},
			{
				icon: 'mdi-editor-format-italic',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('italic');
				}
			},
			{
				separator: true, icon: 'mdi-content-link',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('link');
				}
			},
			{
				icon: 'mdi-editor-format-quote',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('quote');
				}
			},
			{
				icon: 'mdi-action-settings-ethernet',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('code');
				}
			},
			{
				icon: 'mdi-image-crop-original',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('image');
				}
			},
			{
				separator: true, icon: 'mdi-editor-format-list-numbered',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('olist');
				}
			},
			{
				icon: 'mdi-editor-format-list-bulleted',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('ulist');
				}
			},
			{
				icon: 'mdi-editor-format-size',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('heading');
				}
			},
			{
				icon: 'mdi-navigation-more-horiz',
				click: function() {
					cleditor.pagedownEditor.uiManager.doClick('hr');
				}
			},
			{
				separator: true, icon: 'mdi-content-undo',
				click: function() {
					cleditor.editor.undoMgr.undo();
				}
			},
			{
				icon: 'mdi-content-redo',
				click: function() {
					cleditor.editor.undoMgr.redo();
				}
			},

		];

		btnBar.height = 70;
		btnBar.visibleHeight = 48;
		btnBar.btnWidth = 30;
		btnBar.btnHeight = 30;
		btnBar.margin = 40;

		var offset = btnBar.margin;
		btnBar.btns.forEach(function(btn) {
			if(btn.separator) {
				offset += 20;
			}
			btn.offset = offset;
			btn.scaling = new Transitionable([
				0.9,
				0.9
			]);
			btn.opacity = new Transitionable(0.8);
			btn.hover = function(enable) {
				this.scaling.set([
					enable ? 1 : 0.9,
					enable ? 1 : 0.9
				], {duration: 180, curve: 'easeOut'});
				this.opacity.set(enable ? 1 : 0.8, {duration: 180, curve: 'easeOut'});
			};
			offset += btnBar.btnWidth;
		});
		btnBar.width = offset + btnBar.margin;

		var openOffsetY = btnBar.visibleHeight - btnBar.height,
			closedOffsetY = -btnBar.height - 10;

		var isEditorOpen = true;
		btnBar.setEditorOpen = function(isOpen) {
			isEditorOpen = isOpen;
			setTransition();
		};
		var isMenuOpen;
		btnBar.setMenuOpen = function(isOpen) {
			isMenuOpen = isOpen;
			setTransition();
		};
		var pageWidth;
		btnBar.setPageWidth = function(width) {
			pageWidth = width;
			setTransition();
		};
		var isOpen;

		function getTrans() {
			return [
				0,
				isOpen ? openOffsetY : closedOffsetY
			];
		}

		btnBar.trans = new Transitionable(getTrans());
		function setTransition() {
			var newIsOpen = !!isEditorOpen && !isMenuOpen && pageWidth - 100 > btnBar.width;
			if(isOpen === newIsOpen) {
				return;
			}
			isOpen = newIsOpen;
			if(isOpen) {
				btnBar.trans.delay(250);
			}
			btnBar.trans.set(getTrans(), {duration: 120, curve: 'easeOutBounce'});
		}

		return btnBar;
	});
