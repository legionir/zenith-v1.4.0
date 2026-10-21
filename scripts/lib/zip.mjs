import { deflateRawSync } from 'node:zlib';

/** Deterministic ZIP (no timestamps, host paths, symlinks or directory entries). */
export function zipFiles(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  const names = new Set();
  for (const { name, data } of [...files].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some(p => p === '..' || p === '.' || p === '') || names.has(name)) {
      throw new Error(`Unsafe or duplicate ZIP member: ${name}`);
    }
    names.add(name);
    const filename = Buffer.from(name);
    const bytes = Buffer.from(data);
    const compressed = deflateRawSync(bytes, { level: 9 });
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0x21, 12); // 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    local.copy(directory, 6, 4, 30);
    directory.writeUInt32LE(offset, 42);
    locals.push(local, filename, compressed);
    central.push(directory, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.size, 8);
  end.writeUInt16LE(names.size, 10);
  end.writeUInt32LE(central.reduce((n, b) => n + b.length, 0), 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}
