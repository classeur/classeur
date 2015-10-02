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

gulp.task('patch', bumpTask('patch'));
gulp.task('minor', bumpTask('minor'));
gulp.task('major', bumpTask('major'));

gulp.task('tag', function(cb) {
    var version = require('./package.json').version;
    var tag = 'v' + version;
    util.log('Tagging as: ' + util.colors.cyan(tag));
    exec([
        'git add package.json',
        'git commit -m "Prepare release"',
        'git tag -a ' + tag + ' -m "Version ' + version + '"',
        'git push origin master --tags',
        'npm publish',
    ], cb);
});

gulp.task('start', [
	'watch',
	'connect'
]);

gulp.task('default', [
	'sass',
	'sass-base',
	'js'
]);

var vendorJs = [
	'node_modules/angular/angular.js',
	'node_modules/angular-animate/angular-animate.js',
	'node_modules/angular-aria/angular-aria.js',
	'node_modules/angular-messages/angular-messages.js',
	'node_modules/angular-route/angular-route.js',
	'node_modules/angular-material/angular-material.js',
	'node_modules/angular-slugify/angular-slugify.js',
	'node_modules/bezier-easing/build.js',
	'node_modules/clanim/clanim.js',
	'node_modules/googlediff/javascript/diff_match_patch_uncompressed.js', // Needs to come before cledit
	'node_modules/clunderscore/clunderscore.js',
	'node_modules/cledit/scripts/cleditCore.js',
	'node_modules/cledit/scripts/cleditHighlighter.js',
	'node_modules/cledit/scripts/cleditKeystroke.js',
	'node_modules/cledit/scripts/cleditMarker.js',
	'node_modules/cledit/scripts/cleditSelectionMgr.js',
	'node_modules/cledit/scripts/cleditUndoMgr.js',
	'node_modules/cledit/scripts/cleditUtils.js',
	'node_modules/cledit/scripts/cleditWatcher.js',
	'node_modules/cledit/demo/mdGrammar.js',
	'node_modules/filesaver.js/FileSaver.js',
	'node_modules/hammerjs/hammer.js',
	'node_modules/markdown-it/dist/markdown-it.js',
	'node_modules/markdown-it-abbr/dist/markdown-it-abbr.js',
	'node_modules/markdown-it-deflist/dist/markdown-it-deflist.js',
	'node_modules/markdown-it-emoji/dist/markdown-it-emoji.js',
	'node_modules/markdown-it-footnote/dist/markdown-it-footnote.js',
	'node_modules/markdown-it-sub/dist/markdown-it-sub.js',
	'node_modules/markdown-it-sup/dist/markdown-it-sup.js',
	'node_modules/prismjs/components/prism-core.js',
	'node_modules/prismjs/components/prism-markup.js',
	'node_modules/prismjs/components/prism-clike.js',
	'node_modules/prismjs/components/prism-javascript.js',
	'node_modules/prismjs/components/prism-css.js',
	'node_modules/prismjs/components/prism-!(*.min).js',
	'node_modules/mustache/mustache.js',
];

var vendorCss = [
	'node_modules/angular-material/angular-material.css',
	'node_modules/classets/icons/style.css',
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
	require('./');
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

function exec(cmds, cb) {
    cmds.length === 0 ? cb() : childProcess.exec(cmds.shift(), {
        cwd: process.cwd()
    }, function(err, stdout, stderr) {
        if (err) {
            return cb(err);
        }
        util.log(stdout, stderr);
        exec(cmds, cb);
    });
}
