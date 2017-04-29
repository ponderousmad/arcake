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
        this.viewport = viewport ? viewport : "canvas";
        this.room = null;
    }

    View.prototype.setRoom = function (room) {
        this.room = room;
    };

    View.prototype.update = function (now, elapsed, keyboard, pointer) {
        this.angle += elapsed * Math.PI * 0.0001;
    };

    View.prototype.drawMeshes = function (room) {
        if (this.meshes !== null) {
            for (var m = 0; m < this.meshes.length; ++m) {
                room.drawMesh(this.meshes[m], this.program);
            }
        }
    };

    View.prototype.loadBlump = function (image) {
        this.atlas = new WGL.TextureAtlas(image.width, image.height / 2, 1);
        var parameters = {
            pixelSize: 0.01,
            alignX: 0.5,
            alignY: 0.5,
            useCalibration: false
        };
        this.meshes.push(BLUMP.imageToMesh(image, this.atlas, parameters));
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
            var d = 2,
                x = Math.cos(this.angle) * d,
                z = Math.sin(this.angle) * d,
                h = 2;
            room.viewer.positionView(new R3.V(x, z, h), new R3.V(0, 0, -1), new R3.V(0, 0, 1));
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