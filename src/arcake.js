var ARCAKE = (function () {
    "use strict";

    function View(viewport) {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = true;
        this.updateInDraw = true;
        this.updateInterval = 15;
        this.consumeKeys = true;
        this.canvasInputOnly = true;
        this.vrToggleIDs = { enter: "enterVR", exit: "exitVR" };
        this.meshes = [];
        this.program = null;
        this.angle = Math.PI * 0.15;
        this.distance = 2.5;
        this.eyeHeight = 1;
        this.targetHeight = -0.5;
        this.zoom = 1;
        this.viewport = viewport ? viewport : "canvas";
        this.room = null;
        this.prevSpot = null;
        this.up = new R3.V(0, 0, 1);
        this.iceDepth = 0.2;
        this.snowDepth = 0.1;

        this.loadResources();
    }

    View.prototype.loadResources = function () {
        var self = this;
        this.batch = new BLIT.Batch("images/", function() { self.loadBlump(); });
        this.testBlump = this.batch.load("blump.png");
        this.rockTexture = this.batch.load("rockwall.jpg");
        this.iceTexture = this.batch.load("icewall.jpg");
        this.snowTexture = this.batch.load("snowwall.jpg");
        this.batch.commit();
    }

    View.prototype.setRoom = function (room) {
        this.room = room;
    };

    function normalizeAngleRadians(angle) {
        var fullCircle = Math.PI * 2;
        while(angle < 0) {
            angle += fullCircle;
        }
        while (angle > fullCircle) {
            angle -= fullCircle;
        }
        return angle;
    }

    View.prototype.stabPos = function(spot) {
        var stabDir = this.room.stabDirection(spot.x, spot.y, this.viewport),
            eyePos = this.eyePosition();
        return R3.subVectors(eyePos, stabDir.scaled(eyePos.z / stabDir.z));
    };

    View.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (pointer.primary) {
            if (this.prevSpot) {
                var prevStab = this.stabPos(this.prevSpot),
                    stab = this.stabPos(pointer.primary);
                var prevAngle = normalizeAngleRadians(Math.atan2(prevStab.y, prevStab.x)),
                    newAngle = normalizeAngleRadians(Math.atan2(stab.y, stab.x)),
                    angleDelta = newAngle - prevAngle;
                this.angle -= angleDelta;
                this.eyeHeight += pointer.primary.deltaY * 0.01 * this.zoom;
                this.eyeHeight = Math.min(5, Math.max(0, this.eyeHeight));
            }
            this.prevSpot = pointer.primary;
        } else {
            this.prevSpot = null;
        }

        if (pointer.wheelY) {
            var WHEEL_BASE = 20;
            this.zoom *= (WHEEL_BASE + pointer.wheelY) / WHEEL_BASE;
        }

        this.iceDepth = Math.max(0.001, this.iceDepth - elapsed * 0.00001);
        this.snowDepth = Math.max(0.001, this.snowDepth - elapsed * 0.000005);
        if (this.batch.loaded) {
            this.updateLayers();
        }
    };

    View.prototype.drawMeshes = function (room) {
        if (this.meshes !== null) {
            for (var m = 0; m < this.meshes.length; ++m) {
                room.drawMesh(this.meshes[m], this.program);
            }
        }
    };

    View.prototype.winterize = function (base, thickness, smoothing, depths) {
        var sum = 0,
            min = Number.POSITIVE_INFINITY,
            max = Number.NEGATIVE_INFINITY,
            width = this.builder.width,
            height = this.builder.height;

        if (!depths) {
            depths = new Float32Array(width * height);
        }

        base.forEach(function(v) {
            sum += v;
            min = Math.min(v, min);
            max = Math.max(v, max);
        });
        var average = sum / base.length,
            slackFactor =  smoothing * (max - min);

        for (var y = 0; y < height; ++y) {
            for (var x = 0; x < width; ++x) {
                var index = x + y * width,
                    prev = base[index],
                    slack = prev - average,
                    newDepth = prev + thickness - slack * slackFactor;
                depths[index] = Math.max(prev, newDepth);
            }
        }
        return depths;
    }

    View.prototype.loadBlump = function () {
        var image = this.testBlump,
            builder = BLUMP.setupForPaired(image, 0.01);
        this.builder = builder;
        this.depths = builder.depthFromPaired(image, false);
        this.surfaceAtlas = new WGL.TextureAtlas(image.width, image.height / 2, 1);
        this.wallAtlas = new WGL.TextureAtlas(this.rockTexture.width, this.rockTexture.height, 1);
        this.surfaceCoords = this.surfaceAtlas.add(image, 0, 0, builder.width, builder.height);
        this.rockCoords = this.wallAtlas.add(this.rockTexture);
        this.iceCoords = this.wallAtlas.add(this.iceTexture);
        this.snowCoords = this.wallAtlas.add(this.snowTexture);

        this.buildGeometry();
    }

    View.prototype.letItSnow = function () {
        this.iceDepths = this.winterize(this.depths, this.iceDepth, 2, this.iceDepths);
        this.snowDepths = this.winterize(this.iceDepths, this.snowDepth, 5, this.snowDepths);
    };

    View.prototype.buildGeometry = function () {
        var builder = this.builder;
        this.meshes = [];

        this.letItSnow();

        builder.setupTextureSurface(this.surfaceCoords);
        this.meshes.push(builder.constructSurface(this.depths, this.surfaceAtlas.texture()));

        builder.defaultBottom = -0.5;
        builder.setupTextureWalls(this.rockCoords);
        this.meshes.push(builder.constructWall(null, this.depths, this.wallAtlas.texture()));

        builder.color = [1, 1, 1, 0.8];
        builder.setupTextureSurface(this.surfaceCoords);
        this.iceSurface = builder.constructSurface(this.iceDepths, this.surfaceAtlas.texture());
        this.iceSurface.dynamic = true;
        this.meshes.push(this.iceSurface);

        builder.setupTextureWalls(this.iceCoords);
        this.iceWall = builder.constructWall(this.depths, this.iceDepths, this.wallAtlas.texture());
        this.iceWall.dynamic = true;
        this.meshes.push(this.iceWall);

        builder.color = [1, 1, 1, 0.7];
        builder.setupTextureSurface(this.surfaceCoords);
        this.snowSurface = builder.constructSurface(this.snowDepths, this.surfaceAtlas.texture());
        this.snowSurface.dynamic = true;
        this.meshes.push(this.snowSurface);

        builder.setupTextureWalls(this.snowCoords);
        this.snowWall = builder.constructWall(this.iceDepths, this.snowDepths, this.wallAtlas.texture());
        this.snowWall.dynamic = true;
        this.meshes.push(this.snowWall);
    };

    View.prototype.updateLayers = function() {
        this.letItSnow();
        this.builder.updateSurface(this.iceSurface, this.iceDepths);
        this.builder.updateSurface(this.snowSurface, this.snowDepths);
        this.builder.updateWall(this.iceWall, this.depths, this.iceDepths);
        this.builder.updateWall(this.snowWall, this.iceDepths, this.snowDepths);
    };

    View.prototype.eyePosition = function () {
        var d = this.distance * this.zoom,
            x = Math.cos(this.angle) * d,
            y = Math.sin(this.angle) * d;
        return new R3.V(x, y, this.eyeHeight * this.zoom);
    };

    View.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (this.program === null) {
            var shader = room.programFromElements("vertex-test", "fragment-test");
            this.program = {
                shader: shader,
                mvUniform: "uMVMatrix",
                perspectiveUniform: "uPMatrix",
                normalUniform: "uNormalMatrix",
                vertexPosition: room.bindVertexAttribute(shader, "aPos"),
                vertexNormal: room.bindVertexAttribute(shader, "aNormal"),
                vertexUV: room.bindVertexAttribute(shader, "aUV"),
                vertexColor: room.bindVertexAttribute(shader, "aColor"),
                textureVariable: "uSampler"
            };

            room.viewer.near = 0.01;
            room.viewer.far = 50;
            room.gl.enable(room.gl.CULL_FACE);
            room.gl.blendFunc(room.gl.SRC_ALPHA, room.gl.ONE_MINUS_SRC_ALPHA);
            room.gl.enable(room.gl.BLEND);
        }
        if (!this.batch.loaded) {
            return;
        }
        if (room.viewer.showOnPrimary()) {
            room.viewer.positionView(
                this.eyePosition(),
                new R3.V(0, 0, this.targetHeight * this.zoom),
                this.up
            );
            room.setupView(this.program, this.viewport);
            this.drawMeshes(room);
        }
    };

    window.onload = function(e) {
        var canvas = document.getElementById("canvas3D"),
            view = new View("safe"),
            controls = document.getElementById("controls"),
            menuButton = document.getElementById("menuButton"),
            controlsVisible = false;

        canvas.tabIndex = 1000; // Hack to get canvas to accept keyboard input.
        view.inputElement = canvas;

        var room = MAIN.start(canvas, view);
        view.setRoom(room);

        menuButton.addEventListener("click", function(e) {
            controlsVisible = !controlsVisible;
            var slide = controlsVisible ? " slideIn" : "";
            controls.className = "controls" + slide;
            e.preventDefault = true;
            return false;
        });
        MAIN.runTestSuites();
    };

    return {
    };
}());