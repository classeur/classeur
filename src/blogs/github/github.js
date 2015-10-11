angular.module('classeur.blogs.github', [])
	.directive('clGithubBlogForm',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/github/githubBlogForm.html'
			};
		})
	.directive('clGithubBlogPostEntry',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/github/githubBlogPostEntry.html'
			};
		})
	.directive('clGithubBlogPostForm',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'blogs/github/githubBlogPostForm.html'
			};
		})
	.factory('clGithubBlogPlatform',
		function(clBlogPlatform, clConfig) {
			var clGithubBlogPlatform = clBlogPlatform({
				id: 'github',
				name: 'GitHub',
				authorizeUrl: 'https://github.com/login/oauth/authorize'
			});

			function serializeRepoUrl(blog) {
				return 'https://github.com/' + blog.user + '/' + blog.repo;
			}

			clGithubBlogPlatform.defaultBlogSubForm = {
				privateRepo: true
			};

			clGithubBlogPlatform.fillBlogSubForm = function(subForm) {
				if (subForm.user && subForm.repo) {
					subForm.repoUrl = serializeRepoUrl(subForm);
				}
			};

			clGithubBlogPlatform.createBlogFromSubForm = function(subForm) {
				if (!subForm.repoUrl) {
					throw 'Repository URL is required.';
				}
				var parsedRepo = subForm.repoUrl.match(/[\/:]?([^\/:]+)\/([^\/]+?)(?:\.git)?$/);
				if (!parsedRepo) {
					throw 'Invalid repository URL format.';
				}
				var blog = {
					repo: parsedRepo[2],
					user: parsedRepo[1],
					privateRepo: subForm.privateRepo
				};
				if (blog.repo.length > 128 || blog.user.length > 128) {
					throw 'Repository URL is too long.';
				}
				return blog;
			};

			clGithubBlogPlatform.defaultPostSubForm = {
				branch: 'master'
			};

			clGithubBlogPlatform.fillPostSubForm = function(blog, subForm) {
				subForm.repoUrl = serializeRepoUrl(blog);
			};

			clGithubBlogPlatform.createPostFromSubForm = function(subForm) {
				if (!subForm.branch) {
					throw 'Branch is required.';
				}
				if (subForm.branch.length > 128) {
					throw 'Branch name is too long.';
				}
				if (!subForm.filePath) {
					throw 'File path is required.';
				}
				if (subForm.filePath.length > 512) {
					throw 'File path is too long.';
				}
				return {
					branch: subForm.branch,
					filePath: subForm.filePath
				};
			};

			clGithubBlogPlatform.getAuthorizeParams = function(blog) {
				return {
					client_id: clConfig.githubClientId,
					response_type: 'code',
					redirect_uri: clConfig.appUri + '/oauth/github/callback',
					scope: blog.private ? 'repo' : 'public_repo'
				};
			};

			clGithubBlogPlatform.getBlogPostLocation = function(blogPost) {
				var result = [
					'https://github.com',
					blogPost.blog.user,
					blogPost.blog.repo,
					'blob',
					blogPost.branch
				];
				return result.concat(blogPost.filePath.split('/').cl_map(encodeURIComponent)).join('/');
			};

			return clGithubBlogPlatform;
		});
