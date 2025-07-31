// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { ArcCurve, BufferAttribute, BufferGeometry,
Color, Line, LineBasicMaterial, Points, PointsMaterial, 
Quaternion, Vector3 } from 'three';
import { lon2xyz } from './common';

/*
 * Draw an arc flight line
 * The meanings of the 5 parameters: (arc trajectory radius, start angle, end angle)
 */

function createFlyLine(radius, startAngle, endAngle,color) {
  const geometry = new BufferGeometry();
  const arc = new ArcCurve(0, 0, radius, startAngle, endAngle, false);
  const pointsArr = arc.getSpacedPoints(100);
  geometry.setFromPoints(pointsArr);
  const percentArr = [];
  for (let i = 0; i < pointsArr.length; i++) {
    percentArr.push(i / pointsArr.length);
  }
  const percentAttribue = new BufferAttribute(
    new Float32Array(percentArr),
    1
  );
  geometry.attributes.percent = percentAttribue;
  const colorArr = [];
  for (let i = 0; i < pointsArr.length; i++) {
    const color1 = new Color(0xec8f43);
    const color2 = new Color(0xf3ae76);
    const color = color1.lerp(color2, i / pointsArr.length);
    colorArr.push(color.r, color.g, color.b);
  }
  geometry.attributes.color = new BufferAttribute(
    new Float32Array(colorArr),
    3
  );
  const size = 1.3;
  const material = new PointsMaterial({
    size,
    transparent: true,
    depthWrite: false,
  });
  material.onBeforeCompile = function (shader) {
    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      [
        "attribute float percent;",
        "void main() {",
      ].join("\n") 
    );
    shader.vertexShader = shader.vertexShader.replace(
      "gl_PointSize = size;",
      ["gl_PointSize = percent * size;"].join("\n")
    );
  };
  const FlyLine = new Points(geometry, material);
  material.color = new Color(color)
  FlyLine.name = "Flight Line";

  return FlyLine;
}

function flyArc(radius, lon1, lat1, lon2, lat2,options) {
  const sphereCoord1 = lon2xyz(radius, lon1, lat1);
  const startSphereCoord = new Vector3(sphereCoord1.x, sphereCoord1.y, sphereCoord1.z);
  const sphereCoord2 = lon2xyz(radius, lon2, lat2);
  const endSphereCoord = new Vector3(sphereCoord2.x, sphereCoord2.y, sphereCoord2.z);

  const startEndQua = _3Dto2D(startSphereCoord, endSphereCoord)
  const arcline = arcXOY(radius, startEndQua.startPoint, startEndQua.endPoint,options);
  arcline.quaternion.multiply(startEndQua.quaternion)
  return arcline;
}

function _3Dto2D(startSphere, endSphere) {
  const origin = new Vector3(0, 0, 0);
  const startDir = startSphere.clone().sub(origin);
  const endDir = endSphere.clone().sub(origin); 
  const normal = startDir.clone().cross(endDir).normalize();
  const xoyNormal = new Vector3(0, 0, 1);
  const quaternion3D_XOY = new Quaternion().setFromUnitVectors(normal, xoyNormal);
  const startSphereXOY = startSphere.clone().applyQuaternion(quaternion3D_XOY);
  const endSphereXOY = endSphere.clone().applyQuaternion(quaternion3D_XOY);
  const middleV3 = startSphereXOY.clone().add(endSphereXOY).multiplyScalar(0.5);
  const midDir = middleV3.clone().sub(origin).normalize();
  const yDir = new Vector3(0, 1, 0);
  const quaternionXOY_Y = new Quaternion().setFromUnitVectors(midDir, yDir);
  const startSpherXOY_Y = startSphereXOY.clone().applyQuaternion(quaternionXOY_Y);
  const endSphereXOY_Y = endSphereXOY.clone().applyQuaternion(quaternionXOY_Y);
  const quaternionInverse = quaternion3D_XOY.clone().invert().multiply(quaternionXOY_Y.clone().invert())
  return {
    quaternion: quaternionInverse,
    startPoint: startSpherXOY_Y,
    endPoint: endSphereXOY_Y,
  }
}

function arcXOY(radius,startPoint, endPoint,options) {
  const middleV3 = new Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
  const dir = middleV3.clone().normalize()
  const earthRadianAngle = radianAOB(startPoint, endPoint, new Vector3(0, 0, 0))
  const arcTopCoord = dir.multiplyScalar(radius + earthRadianAngle * radius * 0.2)
  const flyArcCenter = threePointCenter(startPoint, endPoint, arcTopCoord)
  const flyArcR = Math.abs(flyArcCenter.y - arcTopCoord.y);
  const flyRadianAngle = radianAOB(startPoint, new Vector3(0, -1, 0), flyArcCenter);
  const startAngle = -Math.PI / 2 + flyRadianAngle;
  const endAngle = Math.PI - startAngle;
  const arcline = circleLine(flyArcCenter.x, flyArcCenter.y, flyArcR, startAngle, endAngle, options.color)
  arcline.center = flyArcCenter;
  arcline.topCoord = arcTopCoord;
  const flyAngle = (endAngle - startAngle) / 7;
  const flyLine = createFlyLine(flyArcR, startAngle, startAngle + flyAngle, options.flyLineColor);
  flyLine.position.y = flyArcCenter.y;
  arcline.add(flyLine);
  flyLine.flyEndAngle = endAngle - startAngle - flyAngle;
  flyLine.startAngle = startAngle;
  flyLine.AngleZ = arcline.flyEndAngle * Math.random();
  arcline.userData['flyLine'] = flyLine;

  return arcline
}

function radianAOB(A, B, O) {
  const dir1 = A.clone().sub(O).normalize();
  const dir2 = B.clone().sub(O).normalize();
  const cosAngle = dir1.clone().dot(dir2);
  const radianAngle = Math.acos(cosAngle);
  return radianAngle
}

function circleLine(x, y, r, startAngle, endAngle,color) {
  const geometry = new BufferGeometry();
  const arc = new ArcCurve(x, y, r, startAngle, endAngle, false);
  const points = arc.getSpacedPoints(80);
  geometry.setFromPoints(points);
  const material = new LineBasicMaterial({
    color:color || 0xd18547,
  });
  const line = new Line(geometry, material);
  return line;
}

function threePointCenter(p1, p2, p3) {
  const L1 = p1.lengthSq();
  const L2 = p2.lengthSq();
  const L3 = p3.lengthSq();
  const x1 = p1.x,
    y1 = p1.y,
    x2 = p2.x,
    y2 = p2.y,
    x3 = p3.x,
    y3 = p3.y;
  const S = x1 * y2 + x2 * y3 + x3 * y1 - x1 * y3 - x2 * y1 - x3 * y2;
  const x = (L2 * y3 + L1 * y2 + L3 * y1 - L2 * y1 - L3 * y2 - L1 * y3) / S / 2;
  const y = (L3 * x2 + L2 * x1 + L1 * x3 - L1 * x2 - L2 * x3 - L3 * x1) / S / 2;
  const center = new Vector3(x, y, 0);
  return center
}

export {
  arcXOY,
  flyArc
}
