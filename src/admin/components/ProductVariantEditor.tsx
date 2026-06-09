import React from 'react';
import { ProductVariantGroup, ProductVariantOption } from '@/hooks/db-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical, Settings2, X, ListPlus, CheckSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProductVariantEditorProps {
  variants: ProductVariantGroup[];
  onChange: (variants: ProductVariantGroup[]) => void;
}

export default function ProductVariantEditor({ variants = [], onChange }: ProductVariantEditorProps) {
  const addGroup = () => {
    onChange([...variants, { name: '', type: 'single', required: false, options: [] }]);
  };

  const updateGroup = (index: number, updates: Partial<ProductVariantGroup>) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    onChange(newVariants);
  };

  const removeGroup = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  const addOption = (groupIndex: number) => {
    const newVariants = [...variants];
    newVariants[groupIndex].options.push({ name: '', price: 0 });
    onChange(newVariants);
  };

  const updateOption = (groupIndex: number, optionIndex: number, updates: Partial<ProductVariantOption>) => {
    const newVariants = [...variants];
    newVariants[groupIndex].options[optionIndex] = { ...newVariants[groupIndex].options[optionIndex], ...updates };
    onChange(newVariants);
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    const newVariants = [...variants];
    newVariants[groupIndex].options.splice(optionIndex, 1);
    onChange(newVariants);
  };

  return (
    <div className="space-y-5">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <Label className="text-lg font-bold flex items-center gap-2 text-foreground mb-1">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Settings2 className="w-5 h-5" />
            </div>
            Varian & Kustomisasi
          </Label>
          <p className="text-xs text-muted-foreground">
            Tambahkan opsi khusus untuk produk ini (cth: Ukuran, Level Pedas, Topping ekstra).
          </p>
        </div>
        <Button 
          type="button" 
          onClick={addGroup} 
          className="rounded-xl font-semibold shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 mr-1.5" strokeWidth={3} /> Tambah Grup
        </Button>
      </div>

      {/* Empty State */}
      {variants.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-2xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-muted/30">
          <div className="w-12 h-12 bg-background rounded-full shadow-sm flex items-center justify-center text-muted-foreground mb-1">
            <ListPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-foreground">Belum ada grup varian</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Produk ini belum memiliki opsi kustomisasi. Klik tombol di atas untuk mulai menambahkan.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {variants.map((group, gIndex) => (
            <Card key={gIndex} className="border border-border/60 shadow-sm overflow-hidden rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              
              {/* Card Header (Group Config) */}
              <CardHeader className="p-4 bg-muted/30 border-b border-border/50 flex flex-col sm:flex-row gap-4 space-y-0 items-start sm:items-center">
                
                <div className="flex items-center gap-3 flex-1 w-full">
                  <div className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-muted rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  <Input 
                    value={group.name} 
                    onChange={e => updateGroup(gIndex, { name: e.target.value })} 
                    placeholder="Nama Grup (cth: Level Pedas, Ukuran Cup)" 
                    className="h-10 font-bold text-base bg-background/50 focus:bg-background border-border/50 shadow-inner"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto pl-11 sm:pl-0">
                  <Select value={group.type} onValueChange={(val: 'single'|'multiple') => updateGroup(gIndex, { type: val })}>
                    <SelectTrigger className="h-9 text-xs w-[160px] bg-background font-medium">
                      <div className="flex items-center gap-2">
                        {group.type === 'multiple' ? <CheckSquare className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border-[4px] border-primary" />}
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single" className="text-xs font-medium">Pilih Satu (Radio)</SelectItem>
                      <SelectItem value="multiple" className="text-xs font-medium">Bisa Banyak (Checkbox)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer select-none",
                    group.required ? "bg-primary/10 border-primary/20 text-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"
                  )}>
                    <Checkbox 
                      id={`req-${gIndex}`} 
                      checked={group.required} 
                      onCheckedChange={(c) => updateGroup(gIndex, { required: !!c })} 
                      className={group.required ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
                    />
                    <Label htmlFor={`req-${gIndex}`} className="text-xs font-bold cursor-pointer leading-none">Wajib Diisi</Label>
                  </div>

                  <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(gIndex)} className="text-muted-foreground hover:bg-red-500/10 hover:text-red-500 h-9 w-9 shrink-0 transition-colors rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Card Content (Options List) */}
              <CardContent className="p-0 bg-background">
                <div className="flex flex-col">
                  {/* Table Header like labels */}
                  {group.options.length > 0 && (
                    <div className="grid grid-cols-[1fr_140px_40px] gap-3 px-5 py-2.5 bg-muted/10 border-b border-border/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <div className="pl-8">Nama Pilihan</div>
                      <div>Harga Tambahan</div>
                      <div></div>
                    </div>
                  )}

                  {/* Options List */}
                  <div className="divide-y divide-border/40">
                    {group.options.map((opt, oIndex) => (
                      <div key={oIndex} className="grid grid-cols-[1fr_140px_40px] gap-3 items-center px-5 py-3 group/opt hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-5 flex justify-center text-muted-foreground/30 text-xs font-mono">{oIndex + 1}</div>
                          <Input 
                            value={opt.name} 
                            onChange={e => updateOption(gIndex, oIndex, { name: e.target.value })} 
                            placeholder="cth: Pedas Sedang, Keju Mozzarella" 
                            className="h-9 text-sm border-transparent hover:border-border focus:border-primary shadow-none bg-transparent transition-all"
                          />
                        </div>
                        
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground/70">+ Rp</span>
                          <Input 
                            type="number" 
                            value={opt.price || ''} 
                            onChange={e => updateOption(gIndex, oIndex, { price: Number(e.target.value) || 0 })} 
                            placeholder="0" 
                            className="h-9 text-sm pl-10 pr-3 font-mono"
                          />
                        </div>

                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeOption(gIndex, oIndex)} 
                          className="h-9 w-9 shrink-0 text-muted-foreground/50 hover:text-destructive hover:bg-red-500/10 opacity-0 group-hover/opt:opacity-100 focus:opacity-100 transition-all rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add Option Button */}
                  <div className="p-3 bg-muted/5 border-t border-border/40">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addOption(gIndex)} 
                      className="h-9 text-xs w-full border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Tambah Pilihan Baru
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
