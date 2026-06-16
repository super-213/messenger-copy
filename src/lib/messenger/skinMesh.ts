import {
	AnimationClip,
	Bone,
	InterpolateLinear,
	Quaternion,
	QuaternionKeyframeTrack,
	Skeleton,
	SkinnedMesh,
	Vector3,
	VectorKeyframeTrack,
	type BufferGeometry,
	type Material
} from 'three';

type SkinAnimationUserData = {
	frames?: number;
	fps?: number;
};

export function createSkin(
	model: BufferGeometry,
	bonesGeometry: BufferGeometry,
	material: Material
): SkinnedMesh {
	const bones: Bone[] = [];
	const position = bonesGeometry.attributes.position;
	const quaternion = bonesGeometry.attributes.quaternion;
	const scale = bonesGeometry.attributes.scale;
	const hierarchy = bonesGeometry.attributes.hierarchy;

	if (!position || !quaternion || !scale || !hierarchy) {
		throw new Error('Bones geometry is missing skin rig attributes.');
	}

	for (let index = 0; index < position.count; index++) {
		const bone = new Bone();
		bone.name = `bone_${index}`;
		bone.position.fromArray(position.array as Float32Array, index * 3);
		bone.quaternion.fromArray(quaternion.array as Float32Array, index * 4).normalize();
		bone.scale.fromArray(scale.array as Float32Array, index * 3);
		bones.push(bone);
	}

	const roots: number[] = [];
	for (let index = 0; index < hierarchy.count; index++) {
		const parent = hierarchy.getX(index) - 1;
		if (parent === -1) {
			roots.push(index);
		} else {
			bones[parent].add(bones[index]);
		}
	}

	const skeleton = new Skeleton(bones);
	const mesh = new SkinnedMesh(model, material);
	for (const root of roots) {
		mesh.add(skeleton.bones[root]);
	}
	mesh.bind(skeleton);
	mesh.normalizeSkinWeights();
	return mesh;
}

export function createSkinAnimation(name: string, animationGeometry: BufferGeometry): AnimationClip {
	const userData = animationGeometry.userData as SkinAnimationUserData;
	if (!userData.frames || !userData.fps) {
		return new AnimationClip(name, 0, []);
	}

	const frames = userData.frames;
	const boneCount = animationGeometry.attributes.position.count / frames;
	const duration = frames / userData.fps;
	const step = duration / Math.max(frames - 1, 1);
	const times = Array.from({ length: frames }, (_, frame) => frame * step);
	const tracks: (QuaternionKeyframeTrack | VectorKeyframeTrack)[] = [];

	for (const attributeName of ['position', 'quaternion', 'scale'] as const) {
		const attribute = animationGeometry.attributes[attributeName];
		if (!attribute) continue;

		const itemSize = attribute.itemSize;
		const scratch = itemSize === 4 ? new Quaternion() : new Vector3();

		for (let bone = 0; bone < boneCount; bone++) {
			const values: number[] = [];
			const trackName = `bone_${bone}.${attributeName}`;
			const boneOffset = bone * itemSize;

			for (let frame = 0; frame < frames; frame++) {
				scratch.fromArray(
					attribute.array as Float32Array,
					frame * boneCount * itemSize + boneOffset
				);
				if (itemSize === 4) {
					(scratch as Quaternion).normalize();
				}
				values.push(...scratch.toArray());
			}

			tracks.push(
				itemSize === 4
					? new QuaternionKeyframeTrack(trackName, times, values, InterpolateLinear)
					: new VectorKeyframeTrack(trackName, times, values, InterpolateLinear)
			);
		}
	}

	return new AnimationClip(name, duration, tracks);
}
