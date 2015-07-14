var childProcess = require('child_process');
var gulp = require('gulp');
var watch = require('gulp-watch');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var streamqueue = require('streamqueue');
var replace = require('gulp-replace');
var sass = require('gulp-sass');
var templateCache = require('gulp-angular-templatecache');
var size = require('gulp-size');
var bump = require('gulp-bump');
var util = require('gulp-util');

function bumpTask(importance) {
	return function() {
		return gulp.src([
				'./package.json'
			])
			.pipe(bump({
				type: importance
			}))
			.pipe(gulp.dest('./'));
	};
}

gulp.task('bump-patch', bumpTask('patch'));
gulp.task('bump-minor', bumpTask('minor'));
gulp.task('bump-major', bumpTask('major'));

function exec(cmd, cb) {
	childProcess.exec(cmd, {
		cwd: process.cwd()
	}, function(err, stdout, stderr) {
		if (!err) {
			util.log(stdout, stderr);
		}
		cb(err);
	});
}

gulp.task('git-tag', function(cb) {
	var version = require('./package.json').version;
	var tag = 'v' + version;
	util.log('Tagging as: ' + util.colors.cyan(tag));
	exec('git commit -a -m "Prepare release"', function(err) {
		err ? cb(err) : exec('git tag -a ' + tag + ' -m "Version ' + version + '"', function(err) {
			err ? cb(err) : exec('git push origin master --tags', cb);
		});
	});
});

var vendorJs = [
	'bower_components/angular/angular.js',
	'bower_components/angular-animate/angular-animate.js',
	'bower_components/angular-aria/angular-aria.js',
	'bower_components/angular-messages/angular-messages.js',
	'bower_components/angular-route/angular-route.js',
	'bower_components/movejs/move.js',
	'bower_components/hammerjs/hammer.js',
	'bower_components/angular-material/angular-material.js',
	'bower_components/angular-slugify/angular-slugify.js',
	'bower_components/google-diff-match-patch-js/diff_match_patch_uncompressed.js',
	'bower_components/cledit/scripts/cleditCore.js',
	'bower_components/cledit/scripts/cleditHighlighter.js',
	'bower_components/cledit/scripts/cleditKeystroke.js',
	'bower_components/cledit/scripts/cleditMarker.js',
	'bower_components/cledit/scripts/cleditSelectionMgr.js',
	'bower_components/cledit/scripts/cleditUndoMgr.js',
	'bower_components/cledit/scripts/cleditUtils.js',
	'bower_components/cledit/scripts/cleditWatcher.js',
	'bower_components/cledit/demo/mdGrammar.js',
	'bower_components/highlightjs/highlight.pack.js',
	'bower_components/markdown-it/dist/markdown-it.js',
	'bower_components/markdown-it-abbr/dist/markdown-it-abbr.js',
	'bower_components/markdown-it-deflist/dist/markdown-it-deflist.js',
	'bower_components/markdown-it-emoji/dist/markdown-it-emoji.js',
	'bower_components/markdown-it-footnote/dist/markdown-it-footnote.js',
	'bower_components/markdown-it-sub/dist/markdown-it-sub.js',
	'bower_components/markdown-it-sup/dist/markdown-it-sup.js',
	'bower_components/prism/components/prism-core.js',
	'bower_components/prism/components/prism-markup.js',
	'bower_components/prism/components/prism-clike.js',
	'bower_components/prism/components/prism-javascript.js',
	'bower_components/prism/components/prism-css.js',
	'bower_components/prism/components/prism-!(*.min).js',
	'bower_components/mustache/mustache.js',
	'bower_components/file-saver.js/FileSaver.js',
];

var vendorBaseCss = [
	'bower_components/emojione/assets/css/emojione.css',
];

var vendorCss = [
	'bower_components/angular-material/angular-material.css',
	'bower_components/classets/icons/style.css',
];

var templateCacheSrc = ['src/**/*.{html,md,json}'];
var jsSrc = ['src/**/*.js'];

function jsStream() {
	return streamqueue({
			objectMode: true
		},
		gulp.src(vendorJs),
		gulp.src(jsSrc),
		gulp.src(templateCacheSrc)
		.pipe(templateCache({
			module: 'classeur.templates',
			standalone: true
		}))
	);
}
gulp.task('js', function() {
	return jsStream()
		.pipe(size({
			//showFiles: true
		}))
		.pipe(ngAnnotate())
		.pipe(uglify())
		.pipe(concat('app-min.js', {
			newLine: ';'
		}))
		.pipe(gulp.dest('public'));

});
gulp.task('js-dev', function() {
	return jsStream()
		.pipe(sourcemaps.init())
		.pipe(concat('app-min.js', {
			newLine: ';'
		}))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public'));
});

var sassSrc = ['src/**/!(base).scss'];

function cssStream() {
	return streamqueue({
			objectMode: true
		},
		gulp.src(vendorBaseCss),
		gulp.src(vendorCss)
		.pipe(replace(/@import\s.*/g, '')),
		gulp.src(sassSrc)
	);
}

gulp.task('sass', function() {
	return cssStream()
		.pipe(sass({
			includePaths: 'src/styles',
			outputStyle: 'compressed'
		}).on('error', sass.logError))
		.pipe(concat('app-min.css'))
		.pipe(gulp.dest('public'));
});
gulp.task('sass-dev', function() {
	cssStream()
		.pipe(sourcemaps.init())
		.pipe(sass({
			includePaths: 'src/styles'
		}).on('error', sass.logError))
		.pipe(concat('app-min.css'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public'));
});
gulp.task('sass-base', function() {
	return streamqueue({
				objectMode: true
			},
			gulp.src(vendorBaseCss),
			gulp.src('src/styles/base.scss')
		)
		.pipe(sass({
			outputStyle: 'compressed'
		}).on('error', sass.logError))
		.pipe(concat('base-min.css'))
		.pipe(gulp.dest('public'));
});

gulp.task('connect', function() {
	process.env.NO_CLUSTER = true;
	require('./index');
});

gulp.task('watch', function() {
	watch(['src/**/*.scss'], function(files, cb) {
		gulp.start('sass-dev');
		cb();
	});
	watch(templateCacheSrc.concat(jsSrc), function(files, cb) {
		gulp.start('js-dev');
		cb();
	});
	gulp.start('sass-dev');
	gulp.start('js-dev');
});

gulp.task('run', [
	'watch',
	'connect'
]);

gulp.task('default', [
	'sass',
	'sass-base',
	'js'
]);
