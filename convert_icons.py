"""
将 logo.png 转换为 Chrome 扩展需要的多个尺寸
需要安装 Pillow 库: pip install Pillow
"""

from PIL import Image
import os

def convert_logo():
    # 打开原始 logo
    try:
        img = Image.open('logo.png')

        # 确保图片是正方形，调整大小
        size = min(img.size)
        img = img.resize((size, size), Image.Resampling.LANCZOS)

        # Chrome 扩展需要的尺寸
        sizes = [16, 32, 48, 128]

        for size in sizes:
            # 调整大小
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            # 保存
            output_file = f'icon{size}.png'
            resized.save(output_file, 'PNG')
            print(f'✅ 已生成: {output_file} ({size}x{size})')

        print('\n🎉 所有图标生成完成！')

    except FileNotFoundError:
        print('❌ 错误: 找不到 logo.png 文件')
        print('请确保 logo.png 在项目根目录下')
    except Exception as e:
        print(f'❌ 转换失败: {e}')

if __name__ == '__main__':
    convert_logo()
