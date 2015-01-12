angular.module('classeur.core.utils', [])
	.factory('uid', function() {
		// Generates a 24 char length random id
		var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		var mapper = Array.apply(null, new Array(24));
		return function() {
			return mapper.map(function() {
				return alphabet[Math.random() * alphabet.length | 0];
			}).join('');
		};
	})
	.factory('toast', function($mdToast) {
		return function(text) {
			$mdToast.show(
				$mdToast.simple()
					.content(text)
					.position('bottom right')
					.hideDelay(6000)
			);
		};
	})
	.factory('panel', function() {
		window.move.defaults = {
			duration: 0
		};

		function Panel(elt, selector) {
			elt = selector ? angular.element(elt[0].querySelector(selector)) : elt;
			this.$elt = elt;
			this.$$elt = elt[0];
		}

		function styleSetter(attr, unit) {
			return function(value) {
				this.$$elt.style[attr] = value !== undefined ? value + unit : '';
				return this;
			};
		}

		[
			'width',
			'height',
			'top',
			'right',
			'bottom',
			'left'
		].forEach(function(attr) {
			Panel.prototype[attr] = styleSetter(attr, 'px');
		});

		Panel.prototype.move = function() {
			return window.move(this.$$elt).ease('out');
		};

		return function(elt, selector) {
			return new Panel(elt, selector);
		};
	})
	.factory('uriValidator', function() {
		var aHrefSanitizationWhitelist = /^\s*(https?|ftp|mailto|tel|file):/,
			imgSrcSanitizationWhitelist = /^\s*(https?|ftp|file):|data:image\//;

		var msie = window.cledit.Utils.isMsie;

		var urlParsingNode = document.createElement("a");

		function urlResolve(url) {
			var href = url;

			if(msie) {
				// Normalize before parse.  Refer Implementation Notes on why this is
				// done in two steps on IE.
				urlParsingNode.setAttribute("href", href);
				href = urlParsingNode.href;
			}

			urlParsingNode.setAttribute('href', href);

			// urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
			return {
				href: urlParsingNode.href,
				protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
				host: urlParsingNode.host,
				search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
				hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
				hostname: urlParsingNode.hostname,
				port: urlParsingNode.port,
				pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
					urlParsingNode.pathname : '/' + urlParsingNode.pathname
			};
		}

		return function(uri, isImage) {
			var regex = isImage ? imgSrcSanitizationWhitelist : aHrefSanitizationWhitelist;
			var normalizedVal;
			normalizedVal = urlResolve(uri).href;
			if(normalizedVal === '' || normalizedVal.match(regex)) {
				return true;
			}
		};
	})
	.run(function($rootScope) {
		// Trigger function that forces a scope variable to change for event listening
		$rootScope.trigger = function(eventName) {
			$rootScope[eventName] = Date.now();
		};
	});
