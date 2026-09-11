#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

NSString * _Nullable OlympusBeginRun(NSError **error);
NSDictionary<NSString *, NSDictionary *> *OlympusSnapshotDownloads(void);
NSURL * _Nullable OlympusWaitForNewOfficeFile(NSDictionary<NSString *, NSDictionary *> *snapshot, NSString *extension, NSTimeInterval timeout, NSError **error);
NSURL * _Nullable OlympusCopyVersionToRun(NSURL *source, NSString *runDirectory, NSUInteger round, NSError **error);
NSString * _Nullable OlympusExtractOfficeFile(NSURL *file, NSError **error);
void OlympusCleanRun(NSString * _Nullable runDirectory);

NS_ASSUME_NONNULL_END
