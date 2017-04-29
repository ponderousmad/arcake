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
        this.angle = 0;
        this.distance = 2;
        this.eyeHeight = 2;
        this.targetHeight = -1;
        this.viewport = viewport ? viewport : "canvas";
        this.room = null;
        this.prevSpot = null;
        this.up = new R3.V(0, 0, 1);
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
            }
            this.prevSpot = pointer.primary;
        } else {
            this.prevSpot = null;
            this.angle += elapsed * Math.PI * 0.0001;
        }

        if (pointer.wheelY) {
            var WHEEL_BASE = 20;
            this.distance *= (WHEEL_BASE + pointer.wheelY) / WHEEL_BASE;
        }
    };

    View.prototype.drawMeshes = function (room) {
        if (this.meshes !== null) {
            for (var m = 0; m < this.meshes.length; ++m) {
                room.drawMesh(this.meshes[m], this.program);
            }
        }
    };

    View.prototype.loadBlump = function (image) {
        var atlas = new WGL.TextureAtlas(image.width, image.height / 2, 1),
            builder = BLUMP.setupForPaired(image, 0.01, atlas),
            depths = builder.depthFromPaired(image, false);
        this.meshes.push(builder.constructSurface(depths, atlas.texture()));
    };

    View.prototype.eyePosition = function () {
        var d = this.distance,
            x = Math.cos(this.angle) * d,
            y = Math.sin(this.angle) * d;
        return new R3.V(x, y, this.eyeHeight);
    };

    View.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (this.program === null) {
            var shader = room.programFromElements("vertex-test", "fragment-test"),
                self = this;
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
            this.batch = new BLIT.Batch("images/");
            this.batch.load("blump.png", function(image) {
                 self.loadBlump(image);
            });
            this.batch.commit();
        }
        if (!this.batch.loaded) {
            return;
        }
        if (room.viewer.showOnPrimary()) {
            room.viewer.positionView(
                this.eyePosition(),
                new R3.V(0, 0, this.targetHeight),
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