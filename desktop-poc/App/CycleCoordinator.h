#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^OlympusProgressHandler)(NSDictionary *detail);
typedef BOOL (^OlympusCancellationCheck)(void);

NSDictionary * _Nullable OlympusRunFileCycle(NSDictionary *payload, OlympusProgressHandler progress, OlympusCancellationCheck cancelled, NSError **error);
NSNumber * _Nullable OlympusScoreFromEvaluation(NSString *evaluation);
NSArray<NSString *> * _Nullable OlympusValidatedFormats(id rawFormats, NSError **error);
NSString *OlympusAutomaticDeliveryInstruction(NSArray<NSString *> *formats, NSUInteger round);

NS_ASSUME_NONNULL_END
