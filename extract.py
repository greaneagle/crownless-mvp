from PIL import Image, ImageFilter
import numpy as np, os
im=Image.open('/mnt/data/Medieval Pixel RPG Asset Kit.png').convert('RGB')
out='/mnt/data/crownless_gate_a/assets'
# Extract montage characters by center coordinates and convert navy showcase matte to alpha.
def extract(name,cx,cy,w=23,h=32):
  ar=np.array(im.crop((cx-w//2,cy-h//2,cx-w//2+w,cy-h//2+h))).astype(float)
  # navy background estimated from pixels at each crop edge; alpha by color distance
  bg=np.median(np.concatenate((ar[:2].reshape(-1,3),ar[-2:].reshape(-1,3),ar[:,:2].reshape(-1,3),ar[:,-2:].reshape(-1,3))),axis=0)
  distance=np.linalg.norm(ar-bg,axis=2)
  # Saturated/bright characters vs navy display mat
  brightness=ar.max(axis=2)
  alpha=np.clip((distance-19)/35,0,1)
  alpha=np.maximum(alpha, np.clip((brightness-75)/55,0,1))
  # preserve dark outlines immediately beside opaque pixels
  from PIL import ImageFilter
  strong=(alpha>.5).astype(np.uint8)*255
  dil=np.array(Image.fromarray(strong).filter(ImageFilter.MaxFilter(3)))/255
  alpha=np.maximum(alpha,np.where((distance>10)&(dil>.5),.6,0))
  # darken edge noise; crop includes no row labels
  rgba=np.dstack([ar.astype('uint8'),(alpha*255).astype('uint8')]); Image.fromarray(rgba,'RGBA').save(os.path.join(out,name+'.png'))
# Hero: walk row 4 directions and 3 animation frames per direction
for direction,coords in {'down':[75,101,127,153,179,205], 'up':[238,264], 'left':[290,316], 'right':[341,367]}.items():
 for i,x in enumerate(coords): extract('hero_walk_'+direction+'_'+str(i),x,71,23,32)
for direction,coords in {'down':[75,101,127,153,179,205], 'up':[238,264], 'left':[290,316], 'right':[341,367]}.items():
 for i,x in enumerate(coords): extract('hero_attack_'+direction+'_'+str(i),x,153,25,32)
# Foot soldiers showcase: each column pair front/back; draw front and back with horizontal mirroring for sides
for j, (name,x) in enumerate([('militia',414),('infantry',471),('spearman',530),('swordsman',589),('archer',765),('bandit',883)]):
 extract(name+'_front',x,71,24,31)
 extract(name+'_back',x+27,71,24,31)
# effects small
extract('swing',1182,271,28,30)
