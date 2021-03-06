'use strict';

var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    R = require('ramda'),
    resemble = require('resemblejs'),
    expect = require('chai').expect,
    nsg = require('../../lib');

describe('node functional tests', function () {
    var imagePaths = [
            'test/fixtures/images/src/house.png',
            'test/fixtures/images/src/lena.jpg',
            'test/fixtures/images/src/lock.png'
        ],
        basePath = 'build/test/output/',
        stylesheetPath = path.join(basePath, 'stylesheet.styl'),
        expectedStylesheetPath = 'test/fixtures/stylesheets/stylus/nsg-test.styl',
        spritePath = path.join(basePath, 'sprite.png'),
        expectedSpritePath = 'test/fixtures/images/expected/nsg.png',
        defaults = {
            src: imagePaths,
            spritePath: spritePath,
            stylesheetPath: stylesheetPath
        };

    function testSpriteGenerationWithOptions(options, done) {
        var expectedOptions;

        options = R.merge(R.clone(defaults), options);
        expectedOptions = R.clone(options);

        nsg(options, function (err) {
            if (err) {
                return done(err);
            }

            expect(options).to.deep.equal(expectedOptions);

            expect(fs.readFileSync(expectedStylesheetPath).toString()).to.equal(fs.readFileSync(stylesheetPath).toString());
            resemble(expectedSpritePath).compareTo(spritePath).onComplete(function(result) {
                expect(result).to.have.property('isSameDimensions', true);
                expect(result).to.have.property('rawMisMatchPercentage').that.is.lessThan(0.5);
                done();
            });
        });
    }

    this.timeout(10000);

    beforeEach(function (done) {
        function executeAndIgnoreEnoent(fn) {
            try {
                fn();
            } catch (e) {
                if (e.code !== 'ENOENT') {
                    throw e;
                }
            }
        }

        executeAndIgnoreEnoent(fs.unlinkSync.bind(null, stylesheetPath));
        executeAndIgnoreEnoent(fs.unlinkSync.bind(null, spritePath));
        executeAndIgnoreEnoent(fs.rmdirSync.bind(null, basePath));

        mkdirp(basePath, done);
    });

    afterEach(function () {
        expectedStylesheetPath = 'test/fixtures/stylesheets/stylus/nsg-test.styl';
    });

    it('should correctly write sprite image and stylesheets when using directly', function (done) {
        testSpriteGenerationWithOptions({}, done);
    });

    it('should correctly write sprite image and stylesheets when using directly with gm', function (done) {
        testSpriteGenerationWithOptions({ compositor: 'gm' }, done);
    });

    it('should correctly write sprite image and stylesheets when using directly with jimp', function (done) {
        testSpriteGenerationWithOptions({ compositor: 'jimp' }, done);
    });

    it('should correctly write sprite image and stylesheets using glob pattern matching', function (done) {
        testSpriteGenerationWithOptions({
            src: [ 'test/fixtures/images/src/*' ]
        }, done);
    });

    it('should correctly write sprite image and stylesheets when target directory does not exist', function (done) {
        fs.rmdirSync(basePath);

        testSpriteGenerationWithOptions({}, done);
    });

    it('should correctly write sprite image and stylesheets using express.js middleware', function (done) {
        var middleware = nsg.middleware({
            src: imagePaths,
            spritePath: spritePath,
            stylesheetPath: stylesheetPath
        });

        middleware(undefined, undefined, function (err) {
            if (err) {
                return done(err);
            }

            expect(fs.readFileSync(expectedStylesheetPath).toString()).to.equal(fs.readFileSync(stylesheetPath).toString());
            expect(fs.readFileSync(expectedSpritePath).toString()).to.equal(fs.readFileSync(spritePath).toString());

            fs.unlinkSync(stylesheetPath);
            fs.unlinkSync(spritePath);

            done();
        });
    });

    it('should not write the sprite image twice if nothing has changed when using connect middleware', function (done) {
        var middleware = nsg.middleware({
                src: imagePaths,
                spritePath: spritePath,
                stylesheetPath: stylesheetPath
            }),
            middlewareWithTimeout = function (callback) {
                setTimeout(function () {
                    middleware(null, null, callback);
                }, 500);
            };

        // it should always be rendered the first time
        middleware(null, null, function (err) {
            if (err) {
                return done(err);
            }

            var firstTime = fs.statSync(spritePath).ctime;

            middlewareWithTimeout(function (err) {
                if (err) {
                    return done(err);
                }

                var secondTime = fs.statSync(spritePath).ctime;

                // it should not have been changed because no files have been changed
                expect(firstTime.getTime()).to.equal(secondTime.getTime());

                // induce new sprite creation
                fs.unlinkSync(spritePath);

                middlewareWithTimeout(function (err) {
                    if (err) {
                        return done(err);
                    }

                    var thirdTime = fs.statSync(spritePath).ctime;

                    expect(thirdTime.getTime()).to.be.above(firstTime.getTime());

                    fs.unlinkSync(stylesheetPath);
                    fs.unlinkSync(spritePath);
                    done();
                });
            });
        });
    });

    it('should correctly write stylesheets when using custom template', function (done) {
        expectedStylesheetPath = 'test/fixtures/stylesheets/stylus/with-custom-template.stylus';

        testSpriteGenerationWithOptions({
            stylesheet: fs.readFileSync('test/fixtures/stylesheets/template.tpl').toString()
        }, done);
    });
});