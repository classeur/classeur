angular.module('classeur.blogs.github', [])
	.directive('clGithubBlogForm', function() {
		return {
			restrict: 'E',
			templateUrl: 'blogs/github/githubBlogForm.html',
			link: function(scope) {
				var form = scope.getNewForm();
				form.privateRepo = true;
			}
		};
	})
	.factory('clGithubBlogPlatform', function(clBlogPlatform, clConstants) {
		var clGithubBlogPlatform = clBlogPlatform('github', 'GitHub', 'icon-github');

		clGithubBlogPlatform.createForm = function(blog) {
			if(blog.user && blog.repo) {
				blog.repoUrl = 'https://github.com/' + blog.user + '/' + blog.repo;
			}
			return blog;
		};

		clGithubBlogPlatform.validateForm = function(form) {
			if (!form.repoUrl) {
				throw 'Repository URL is required.';
			}
			var parsedRepo = form.repoUrl.match(/[\/:]?([^\/:]+)\/([^\/]+?)(?:\.git)?$/);
			if (!parsedRepo) {
				throw 'Invalid repository URL format.';
			}
			var blog = {
				repo: parsedRepo[2],
				user: parsedRepo[1],
				privateRepo: form.privateRepo
			};
			if (blog.repo.length > 128 || blog.user.length > 128) {
				throw 'Repository URL is too long.';
			}
			return blog;
		};

		clGithubBlogPlatform.getOauthUrlParams = function(blog) {
			return {
				url: 'https://github.com/login/oauth/authorize',
				client_id: clConstants.githubClientId,
				response_type: 'code',
				redirect_uri: clConstants.serverUrl + '/oauth/github/callback',
				scope: blog.private ? 'repo' : 'public_repo'
			};
		};

		return clGithubBlogPlatform;
	});
