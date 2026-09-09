#import <AppKit/AppKit.h>
#import <PDFKit/PDFKit.h>

static CGImageRef RenderPage(PDFPage *page) CF_RETURNS_RETAINED {
    NSRect bounds = [page boundsForBox:kPDFDisplayBoxMediaBox]; CGFloat scale = 2.2;
    size_t width = MAX(1, (size_t)(bounds.size.width * scale)), height = MAX(1, (size_t)(bounds.size.height * scale));
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(NULL, width, height, 8, 0, colorSpace, (CGBitmapInfo)kCGImageAlphaPremultipliedLast);
    CGColorSpaceRelease(colorSpace);
    if (!context) return NULL;
    CGContextSetRGBFillColor(context, 1, 1, 1, 1); CGContextFillRect(context, CGRectMake(0, 0, width, height));
    CGContextScaleCTM(context, scale, scale); [page drawWithBox:kPDFDisplayBoxMediaBox toContext:context];
    CGImageRef image = CGBitmapContextCreateImage(context); CGContextRelease(context); return image;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) return 2;
        NSString *mode = @(argv[1]); NSURL *url = [NSURL fileURLWithPath:@(argv[2])]; NSMutableArray *pages = [NSMutableArray array];
        if ([mode isEqualToString:@"pdf"]) {
            PDFDocument *document = [[PDFDocument alloc] initWithURL:url]; if (!document) return 3;
            for (NSInteger index = 0; index < document.pageCount; index++) {
                PDFPage *page = [document pageAtIndex:index];
                NSString *embedded = [page.string ?: @"" stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
                if (embedded.length >= 20) [pages addObject:@{@"page": @(index + 1), @"text": embedded, @"method": @"embedded"}];
                else {
                    CGImageRef image = RenderPage(page); NSString *imagePath = [NSString stringWithFormat:@"%@.page-%ld.png", url.path, (long)(index + 1)];
                    if (image) { NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:image]; [[bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}] writeToFile:imagePath atomically:YES]; CGImageRelease(image); }
                    [pages addObject:@{@"page": @(index + 1), @"text": @"", @"method": @"ocr", @"imagePath": imagePath}];
                }
            }
        } else return 3;
        NSData *json = [NSJSONSerialization dataWithJSONObject:@{@"pages": pages} options:0 error:nil];
        [[NSFileHandle fileHandleWithStandardOutput] writeData:json];
    }
    return 0;
}
